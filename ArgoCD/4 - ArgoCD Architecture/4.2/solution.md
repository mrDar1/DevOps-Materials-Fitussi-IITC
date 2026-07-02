# Lab 4.2 – GitOps Update Cycle (Fork, Edit, Sync)

## Prerequisites

```bash
kubectl get deploy -n default | grep guestbook
kubectl get application -n argocd
```

**Output:**
```
guestbook-ui   1/1     1            1           2m

NAME        SYNC STATUS   HEALTH STATUS
guestbook   Synced        Healthy
```

If the app isn't there yet, apply [Lab 4.1](../4.1/guestbook-app.yaml)'s manifest
and sync it first.

---

## Part 1: Fork the Example Repo

Forked via GitHub CLI instead of the web UI "Fork" button (same result):

```bash
gh repo fork lm-academy/argocd-example-apps --fork-name argocd-example-apps-labs --clone=false
```

**Result:** `https://github.com/LironeFitoussi/argocd-example-apps-labs`
(forked from the course org's copy of `argoproj/argocd-example-apps`).

You must fork rather than push directly to the original — you don't have write
access to `argoproj/argocd-example-apps` (or the instructor's copy), so ArgoCD
needs to point at a repo you actually control.

---

## Part 2: Point the Application at the Fork

Update `guestbook-app.yaml`'s `source.repoURL`:

```diff
- repoURL: https://github.com/argoproj/argocd-example-apps.git
+ repoURL: https://github.com/LironeFitoussi/argocd-example-apps-labs.git
```

```bash
kubectl apply -f guestbook-app.yaml
kubectl describe application guestbook -n argocd
```

**Output (excerpt):**
```
Spec:
  Source:
    Path:             guestbook
    Repo URL:         https://github.com/LironeFitoussi/argocd-example-apps-labs.git
    Target Revision:  HEAD
```

No special ArgoCD configuration is needed to "link" the new repo — ArgoCD just
diffs whatever `repoURL`/`path` currently says against the live cluster. It
could point at a completely unrelated repo and ArgoCD would happily try to
reconcile the cluster to match it.

### How ArgoCD knows which live resources belong to this Application

Every resource ArgoCD manages gets stamped with a tracking annotation:

```bash
kubectl get deploy guestbook-ui -n default -o jsonpath='{.metadata.annotations}'
```

**Output (excerpt):**
```
"argocd.argoproj.io/tracking-id": "guestbook:apps/Deployment:default/guestbook-ui"
```

Format: `<app-name>:<group>/<kind>:<namespace>/<name>`. Any resource without a
matching tracking-id (e.g. a Deployment created some other way) is ignored by
this Application, even if it lives in the same namespace.

---

## Part 3: Edit the Deployment and Push

Bumped replicas from 1 to 3 in the fork and pushed straight to `master`
(cloned locally instead of editing in the GitHub web UI — same effect):

```bash
git clone https://github.com/LironeFitoussi/argocd-example-apps-labs.git
cd argocd-example-apps-labs
sed -i 's/replicas: 1/replicas: 3/' guestbook/guestbook-ui-deployment.yaml
git add guestbook/guestbook-ui-deployment.yaml
git commit -m "Increase replicas to three"
git push origin master
```

**Output:**
```
[master a9e8980] Increase replicas to three
 1 file changed, 1 insertion(+), 1 deletion(-)
To https://github.com/LironeFitoussi/argocd-example-apps-labs.git
   b0abd6c..a9e8980  master -> master
```

---

## Part 4: Detect the Drift

ArgoCD polls the repo roughly every 3 minutes by default, or you can force a
comparison immediately by clicking **Refresh** in the UI, or:

```bash
kubectl get application guestbook -n argocd
```

**Output:**
```
NAME        SYNC STATUS   HEALTH STATUS
guestbook   OutOfSync     Healthy
```

Note **Health = Healthy** but **Sync = OutOfSync** — the running Pod is fine,
it's just running the wrong *desired count*. Health and sync status are
independent axes.

```bash
kubectl get application guestbook -n argocd -o jsonpath='{.status.sync.revision}'
```

**Output:**
```
a9e898041745f7cc617f0fe26b6ee8759a582080
```

ArgoCD has already picked up the new commit — it's just waiting for a manual
sync (no auto-sync policy configured on this Application).

In the UI, clicking the yellow "out of sync" indicator → **Diff** shows only
`spec.replicas: 1` (live, left) vs. `spec.replicas: 3` (desired, right).

---

## Part 5: Sync

Click **Synchronize** in the UI, or via CLI (`argocd app sync guestbook`), or
directly against the Application resource if the CLI isn't installed:

```bash
kubectl patch application guestbook -n argocd --type merge \
  -p '{"operation": {"initiatedBy": {"username": "admin"}, "sync": {"syncStrategy": {"hook": {}}}}}'
```

### Verify

```bash
kubectl get application guestbook -n argocd
kubectl get deploy guestbook-ui -n default
kubectl get pods -n default
```

**Output:**
```
NAME        SYNC STATUS   HEALTH STATUS
guestbook   Synced        Healthy

NAME           READY   UP-TO-DATE   AVAILABLE   AGE
guestbook-ui   3/3     3            3           2m

NAME                            READY   STATUS    RESTARTS   AGE
guestbook-ui-6595f948db-glqq9   1/1     Running   0          12s
guestbook-ui-6595f948db-rngl7   1/1     Running   0          2m
guestbook-ui-6595f948db-v6vmn   1/1     Running   0          12s
```

Three replicas, all `Running`, no `kubectl apply`/`kubectl scale` involved —
ArgoCD diffed the fork against the live cluster and reconciled the difference
on its own. This closes the full GitOps loop: **fork → edit → commit → push →
ArgoCD detects drift → sync → cluster converges**.

---

## Key Takeaways

| Concept | Detail |
|---|---|
| Why fork | No write access to the original repo — ArgoCD needs a `repoURL` you control |
| Re-pointing an app | Just edit `spec.source.repoURL` and re-`apply` — no other config needed |
| Resource ownership | `argocd.argoproj.io/tracking-id: <app>:<group>/<kind>:<namespace>/<name>` annotation on every managed resource |
| Drift detection | Automatic (~3 min poll) or forced via UI **Refresh** — detection ≠ auto-apply |
| Health vs. Sync | Independent: a Healthy app can still be OutOfSync (wrong desired state, but what's running works) |
| Sync without CLI | `kubectl patch application <name> -n argocd --type merge -p '{"operation":{"sync":{}}}'` |
