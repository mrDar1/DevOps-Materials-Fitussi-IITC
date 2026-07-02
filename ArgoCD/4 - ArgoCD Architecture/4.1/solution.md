# Lab 4.1 – Deploy First Application

## Part 0: Target the Minikube Cluster

This lab runs against the local **minikube** cluster (not a remote EKS cluster).
Make sure `kubectl` is pointed at it before doing anything else:

```bash
kubectl config use-context minikube
kubectl config current-context
```

**Expected output:**
```
Switched to context "minikube".
minikube
```

```bash
kubectl get nodes
```

**Expected output:**
```
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   ...   v1.35.1
```

> Note: ArgoCD itself must already be installed in this cluster (see Lab 3.1)
> before continuing — check with `kubectl get pods -n argocd`. If that
> namespace doesn't exist yet, install it as below.

### Install ArgoCD (if the `argocd` namespace doesn't exist yet)

```bash
kubectl create namespace argocd
helm upgrade argocd argoproj/argo-cd --install --namespace argocd --create-namespace
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=240s
kubectl get pods -n argocd
```

**Output:**
```
NAME                                                READY   STATUS    RESTARTS   AGE
argocd-application-controller-0                     1/1     Running   0          4m
argocd-applicationset-controller-5bd55d986f-pxvgb   1/1     Running   0          4m
argocd-dex-server-6ddd6bd68f-z7wbk                  1/1     Running   0          4m
argocd-notifications-controller-7bf56786d5-tll8l    1/1     Running   0          4m
argocd-redis-7c97ccbdcc-b4ndw                       1/1     Running   0          4m
argocd-repo-server-5f94c6ff7f-pv6hq                 1/1     Running   0          4m
argocd-server-5855bcfbdb-gltpc                      1/1     Running   0          4m
```

---

## Part 1: Write the Application Manifest

Instead of using **New App** in the UI (which doesn't persist a YAML file), define
the `Application` resource declaratively as `guestbook-app.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
spec:
  project: default

  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook

  destination:
    server: https://kubernetes.default.svc
    namespace: default
```

Key points:
- `apiVersion` is `argoproj.io/v1alpha1` (custom CRD, not core `v1`).
- `metadata.namespace` is `argocd` — the Application resource itself always lives
  in the ArgoCD namespace, regardless of where its manifests get deployed.
- `spec.source.repoURL` must be an object (`source: { repoURL, targetRevision, path }`),
  not a bare string.
- `targetRevision: HEAD` is a rolling pointer to the latest commit on the default
  branch — convenient for a lab, but in production you'd pin a tag or commit SHA
  so deploys are reproducible.
- `spec.destination.server: https://kubernetes.default.svc` targets the local
  (in-cluster) API server — i.e. the same cluster ArgoCD itself runs in, which
  here is **minikube**. A remote cluster would use its own API server URL here
  (registered first via `argocd cluster add`).

> `repoURL` in the file on disk now points at the fork created in
> [Lab 4.2](../4.2/solution.md) (`LironeFitoussi/argocd-example-apps-labs`).
> It originally pointed at `https://github.com/argoproj/argocd-example-apps.git`
> as shown above — swap it back if you want to replay this lab in isolation.

---

## Part 2: Create the Application

```bash
kubectl apply -f .
```

**Output:**
```
application.argoproj.io/guestbook created
```

### Verify

```bash
kubectl get application -n argocd
```

**Output:**
```
NAME        SYNC STATUS   HEALTH STATUS
guestbook   OutOfSync     Missing
```

The Application is registered, but nothing has been deployed yet — ArgoCD
only *detects* drift by default, it does not auto-apply.

```bash
kubectl describe application guestbook -n argocd
```

**Output (excerpt):**
```
Spec:
  Destination:
    Namespace:  default
    Server:     https://kubernetes.default.svc
  Project:      default
  Source:
    Path:             guestbook
    Repo URL:         https://github.com/argoproj/argocd-example-apps.git
    Target Revision:  HEAD
Status:
  Health:
    Status:  Missing
  Resources:
    Kind:       Service
    Name:       guestbook-ui
    Namespace:  default
    Status:     OutOfSync
    Group:      apps
    Kind:       Deployment
    Name:       guestbook-ui
    Namespace:  default
    Status:     OutOfSync
  Sync:
    Status:  OutOfSync
Events:
  Type    Reason           Age   From                           Message
  ----    ------           ----  ----                           -------
  Normal  ResourceUpdated  4s    argocd-application-controller  Updated sync status:  -> OutOfSync
  Normal  ResourceUpdated  4s    argocd-application-controller  Updated health status:  -> Missing
```

---

## Part 3: Confirm Nothing Is Deployed Yet

```bash
kubectl get deployments -n default
kubectl get services -n default
```

**Output:** no `guestbook-ui` Deployment; only the default `kubernetes`
Service — confirming the manifests declared in the repo don't exist in the
live cluster yet, hence `OutOfSync`.

---

## Part 4: Inspect in the UI

- Open the ArgoCD UI → the `guestbook` app tile shows **OutOfSync** / **Missing**.
- Click into the app → **App Diff** shows ArgoCD's expected `Service` and
  `Deployment` manifests with no live counterpart.

---

## Part 5: Sync the Application

Click **Synchronize** in the UI (defaults are fine — no options need to change),
or via CLI:

```bash
argocd app sync guestbook
```

Without the `argocd` CLI installed, the same sync operation can be triggered
directly against the Application CRD's `operation` field:

```bash
kubectl patch application guestbook -n argocd --type merge \
  -p '{"operation": {"initiatedBy": {"username": "admin"}, "sync": {"syncStrategy": {"hook": {}}}}}'
```

ArgoCD creates the `Service`, then the `Deployment` → `ReplicaSet` → `Pod`.

### Verify

```bash
kubectl get deployments -n default
kubectl get pods -n default
kubectl get application guestbook -n argocd
```

**Output:**
```
NAME           READY   UP-TO-DATE   AVAILABLE   AGE
guestbook-ui   1/1     1            1           27s

NAME                            READY   STATUS    RESTARTS   AGE
guestbook-ui-6595f948db-rngl7   1/1     Running   0          27s

NAME        SYNC STATUS   HEALTH STATUS
guestbook   Synced        Healthy
```

Application status flips to **Synced** / **Healthy**.

---

## Part 6: Access the Application

```bash
kubectl get service -n default
```

**Output:**
```
NAME           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
guestbook-ui   ClusterIP   10.100.18.45    <none>        80/TCP    27s
kubernetes     ClusterIP   10.96.0.1       <none>        443/TCP   2d19h
```

```bash
kubectl port-forward service/guestbook-ui -n default 8081:80
```

**Output:**
```
Forwarding from 127.0.0.1:8081 -> 80
Forwarding from [::1]:8081 -> 80
```

### Validation

Browse to `http://localhost:8081` → guestbook page loads, confirming the app
is up and reachable.

---

## Key Takeaways

| Concept | Detail |
|---|---|
| `Application` CRD | `apiVersion: argoproj.io/v1alpha1`, `kind: Application` |
| Where it lives | Application resource → `argocd` namespace; deployed manifests → `spec.destination.namespace` |
| `source.repoURL` | Must be nested under `source`, not a top-level string |
| `targetRevision: HEAD` | Rolling pointer to latest commit — fine for labs, use tags/SHAs in production |
| Default sync policy | Manual — drift is detected (`OutOfSync`) but not auto-applied |
| Sync | Creates Service → Deployment → ReplicaSet → Pod, in that order |
| Access | `kubectl port-forward service/guestbook-ui -n default 8081:80` |
| Resource tracking | ArgoCD stamps `argocd.argoproj.io/tracking-id: guestbook:apps/Deployment:default/guestbook-ui` on every managed resource — that's how it knows a resource belongs to this Application |
