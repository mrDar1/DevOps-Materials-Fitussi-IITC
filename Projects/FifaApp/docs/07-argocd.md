# Stage 7 — GitOps with ArgoCD

## Goal
Replace manual `kubectl apply` with a GitOps workflow.  
ArgoCD watches the `k8s/` directory in your `FifaApp-infra` repository and automatically reconciles the cluster to match it. A `git push` IS a deployment.

---

## What changes

| | Stage 6 | Stage 7 |
|--|--|--|
| Deploy trigger | `kubectl apply -R -f k8s/` | `git push` to FifaApp-infra |
| Manifest location | Local workspace | `FifaApp-infra/k8s/` |
| Rollback | Redeploy manually | `git revert` + push |
| Drift protection | None | ArgoCD selfHeal |
| Audit trail | kubectl history | Git log |

---

## Step 1 — Add ArgoCD to Terraform

In `FifaApp-infra/infra/`, create `argocd.tf`:

```hcl
resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  namespace        = "argocd"
  create_namespace = true
  version          = "7.7.11"

  depends_on = [module.eks]

  set {
    name  = "configs.params.server\\.insecure"
    value = "true"
  }
}
```

Apply:

```bash
cd FifaApp-infra/infra
terraform apply
```

> `server.insecure = true` disables TLS on the ArgoCD server so port-forwarding
> works over plain HTTP. Fine for this setup — not for production.

---

## Step 2 — Move manifests into FifaApp-infra

Create `k8s/` inside your `FifaApp-infra` repo and copy the manifests from your
local workspace. The structure mirrors what you had before, just in a different repo:

```
FifaApp-infra/
└── k8s/
    ├── namespace.yaml
    ├── backend/
    │   ├── secret.yaml
    │   ├── deployment.yaml
    │   └── service.yaml
    ├── frontend/
    │   ├── configmap.yaml
    │   ├── deployment.yaml
    │   └── service.yaml
    └── ingress.yaml
```

### Update image references

Get your ECR URIs from Terraform output:

```bash
cd FifaApp-infra/infra
BACKEND_URI=$(terraform output -raw ecr_backend_uri)
FRONTEND_URI=$(terraform output -raw ecr_frontend_uri)
echo $BACKEND_URI
echo $FRONTEND_URI
```

In `k8s/backend/deployment.yaml`, update the image and pull policy:

```yaml
image: <ECR_BACKEND_URI>:latest
imagePullPolicy: Always
```

In `k8s/frontend/deployment.yaml`:

```yaml
image: <ECR_FRONTEND_URI>:latest
imagePullPolicy: Always
```

Commit and push:

```bash
cd FifaApp-infra
git add k8s/
git commit -m "Add K8s manifests — ArgoCD source of truth"
git push
```

> From this point on, **never run `kubectl apply` to deploy the app**.
> All changes go through git.

---

## Step 3 — Create the ArgoCD Application

Create `argocd-app.yaml` (anywhere — you apply this once and then discard it):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: fifaapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<your-org>/FifaApp-infra
    targetRevision: main
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: fifaapp
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Apply it:

```bash
kubectl apply -f argocd-app.yaml
```

ArgoCD immediately begins syncing — it reads `FifaApp-infra/k8s/` from GitHub
and applies everything to the cluster.

> **Private repo?** Add your credentials to ArgoCD first:
> ```bash
> kubectl create secret generic argocd-repo-creds \
>   -n argocd \
>   --from-literal=url=https://github.com/<your-org>/FifaApp-infra \
>   --from-literal=username=<github-username> \
>   --from-literal=password=<github-pat>
> kubectl label secret argocd-repo-creds -n argocd \
>   argocd.argoproj.io/secret-type=repository
> ```

---

## Step 4 — Access the ArgoCD UI

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:80
```

Open [http://localhost:8080](http://localhost:8080).

Login:
- Username: `admin`
- Password:
  ```bash
  kubectl -n argocd get secret argocd-initial-admin-secret \
    -o jsonpath="{.data.password}" | base64 -d
  ```

You should see the `fifaapp` Application with a green **Synced** status.

---

## Step 5 — Verify GitOps in action

Test the loop — change a replica count:

```bash
# In FifaApp-infra, edit k8s/backend/deployment.yaml: replicas: 3
git add k8s/backend/deployment.yaml
git commit -m "Scale backend to 3 replicas"
git push
```

Watch ArgoCD apply it without any kubectl:

```bash
kubectl get pods -n fifaapp -w
```

Within ~30 seconds a third backend pod appears.

Now try breaking the GitOps contract:

```bash
kubectl scale deployment fifaapp-backend -n fifaapp --replicas=1
```

Watch ArgoCD revert it back to 3 within seconds. **Git always wins.**

---

## Key concepts

**`selfHeal: true`** — if someone changes the cluster directly with kubectl,
ArgoCD reverts it back to what's in git. The cluster is always driven by the repo.

**`prune: true`** — if you delete a file from `k8s/`, ArgoCD deletes the
corresponding resource from the cluster. Deletions are also git operations.

**`automated` sync** — ArgoCD polls the git repo every 3 minutes by default.
You can also configure a webhook for instant sync on push.

---

## Verify

```bash
kubectl get application fifaapp -n argocd
kubectl get pods -n fifaapp
kubectl get ingress -n fifaapp
```

---

## Stuck? Check the solution
```
solutions/07-argocd/
```

**Next:** Automate image builds with GitHub Actions — push triggers test → build → push to ECR → update image tag in `FifaApp-infra/k8s/` → ArgoCD deploys (Stage 8)
