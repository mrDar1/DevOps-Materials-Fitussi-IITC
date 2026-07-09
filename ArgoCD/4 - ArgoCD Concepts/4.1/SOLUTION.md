# Lab 4.1 — Deploy First ArgoCD Application

## Goal

Deploy the `guestbook` app from the ArgoCD example repo using an ArgoCD `Application` manifest.

---

## Step 1 — Create the Application Manifest

Create `guestbook-app.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd       # Application resource lives in argocd namespace
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD  # Always tracks latest commit on default branch
    path: guestbook       # Subdirectory within the repo to deploy
  destination:
    server: https://kubernetes.default.svc  # In-cluster reference
    namespace: default    # Where Kubernetes resources will be deployed
```

Key fields:
| Field | Value | Purpose |
|---|---|---|
| `apiVersion` | `argoproj.io/v1alpha1` | ArgoCD CRD group |
| `kind` | `Application` | ArgoCD Application resource |
| `metadata.namespace` | `argocd` | Where the Application CR lives |
| `spec.source.targetRevision` | `HEAD` | Rolling pointer to latest commit (use tags/hashes in production) |
| `spec.destination.server` | `https://kubernetes.default.svc` | Local cluster in-cluster address |
| `spec.destination.namespace` | `default` | Target namespace for Kubernetes manifests |

> **Production note:** `HEAD` always deploys the latest commit. Pin to a specific tag or commit hash in prod to control what version is deployed.

---

## Step 2 — Apply the Manifest

```bash
kubectl apply -f guestbook-app.yaml
```

Expected output:
```
application.argoproj.io/guestbook created
```

---

## Step 3 — Verify Application Created

```bash
kubectl get application -n argocd
```

Expected: `guestbook` app with status `OutOfSync` (ArgoCD detected desired state differs from live cluster).

Inspect details:
```bash
kubectl describe application guestbook -n argocd
```

---

## Step 4 — Sync the Application

ArgoCD default behavior: detect drift but **not** auto-apply. Must sync manually.

**Via UI:**
1. Open ArgoCD UI → click `guestbook` app
2. Click **Sync** → **Synchronize**

**Via CLI:**
```bash
argocd app sync guestbook
```

ArgoCD will create the `Deployment` and `Service` in the `default` namespace.

---

## Step 5 — Verify Deployment

```bash
kubectl get deployment -n default
kubectl get pods -n default
kubectl get service -n default
```

---

## Step 6 — Access the App (Optional)

```bash
kubectl port-forward service/guestbook-ui 8081:80 -n default
```

Open: `http://localhost:8081`

---

## Key Concepts

- **Application CR** lives in `argocd` namespace; Kubernetes manifests deploy to destination namespace
- **Out of Sync** = desired state (Git) ≠ live state (cluster)
- **Sync** = ArgoCD applies Git manifests to cluster
- `HEAD` revision = rolling pointer to latest commit on default branch
- Default sync policy = **manual** (ArgoCD detects drift, waits for human trigger)
