# Stage 7 — GitOps with ArgoCD + Immutable Image Tags

## Goal
Replace manual `kubectl apply` with a GitOps workflow and switch from `:latest`
to immutable image tags.  
ArgoCD watches `FifaApp-infra/k8s/` in git. When you update an image tag and push,
ArgoCD applies the change. Stage 8 will automate the tag update — here you do it manually
so you understand what the automation is doing.

---

## Why not `:latest`?

| | `:latest` | `:abc123f` (SHA tag) |
|--|--|--|
| Rollback | Rebuild old image | `git revert` the tag commit |
| What's running? | Unknown | Traceable to exact commit |
| Concurrent deploys | Race conditions | Each tag is immutable |
| ArgoCD change detection | No diff (tag didn't change) | Detects the new tag value |

With `:latest`, ArgoCD sees no manifest change when you push a new image — the tag is still
`latest` in the YAML. SHA tags fix this: every image push produces a new tag, which changes
the manifest, which ArgoCD detects and deploys.

---

## What changes

| | Stage 6 | Stage 7 |
|--|--|--|
| Deploy trigger | `kubectl apply -R -f k8s/` | `git push` to FifaApp-infra |
| Manifest location | Local workspace | `FifaApp-infra/k8s/` |
| Image tag | `:latest` | `:abc123f` (git SHA) |
| Rollback | Redeploy manually | `git revert` + push |
| Drift protection | None | ArgoCD selfHeal |

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

---

## Step 2 — Build and push images with a SHA tag

Instead of `:latest`, tag images with the git commit SHA of the app repo:

```bash
ECR_REGISTRY=$(terraform output -raw ecr_registry)
BACKEND_URI=$(terraform output -raw ecr_backend_uri)
FRONTEND_URI=$(terraform output -raw ecr_frontend_uri)
REGION=us-east-1

aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# Use the short git SHA as the tag
cd FifaApp-backend
IMAGE_TAG=$(git rev-parse --short HEAD)
docker build -t $BACKEND_URI:$IMAGE_TAG .
docker push $BACKEND_URI:$IMAGE_TAG
echo "Backend tag: $IMAGE_TAG"

cd ../FifaApp-frontend
IMAGE_TAG=$(git rev-parse --short HEAD)
docker build -t $FRONTEND_URI:$IMAGE_TAG .
docker push $FRONTEND_URI:$IMAGE_TAG
echo "Frontend tag: $IMAGE_TAG"
```

> In Stage 8, GitHub Actions runs these commands automatically on every push.
> Here you're doing it once by hand to understand what CI will automate.

---

## Step 3 — Move manifests into FifaApp-infra

Create `k8s/` inside your `FifaApp-infra` repo:

```
FifaApp-infra/
└── k8s/
    ├── namespace.yaml
    ├── backend/
    │   ├── secret.yaml
    │   ├── deployment.yaml   ← image tag updated to SHA
    │   └── service.yaml
    ├── frontend/
    │   ├── configmap.yaml
    │   ├── deployment.yaml   ← image tag updated to SHA
    │   └── service.yaml
    └── ingress.yaml
```

In `k8s/backend/deployment.yaml`, set the exact SHA tag you just pushed:

```yaml
image: <ECR_BACKEND_URI>:<IMAGE_TAG>   # e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/fifaapp-backend:a1b2c3d
imagePullPolicy: Always
```

Same for `k8s/frontend/deployment.yaml`.

Commit and push:

```bash
cd FifaApp-infra
git add k8s/
git commit -m "Add K8s manifests — deploy backend:$BACKEND_TAG frontend:$FRONTEND_TAG"
git push
```

> **This git commit is the deployment record.** The commit message tells you exactly
> which image version was deployed and when.

---

## Step 4 — Create the ArgoCD Application

Create `argocd-app.yaml` (apply once, then you can discard the file):

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

> **Private repo?** Configure git credentials first:
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

## Step 5 — Access the ArgoCD UI

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:80
```

Open [http://localhost:8080](http://localhost:8080).  
Username: `admin`  
Password:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

You should see the `fifaapp` Application with green **Synced** status, showing
the exact SHA tag that is deployed.

---

## Step 6 — Verify the full GitOps loop

Make a code change, build a new image, and update the manifest manually:

```bash
# 1. Make a code change in FifaApp-backend, commit and push
cd FifaApp-backend
# ... edit something ...
git add . && git commit -m "Fix: improve player validation"
git push

# 2. Build and push the new image with the new SHA
NEW_TAG=$(git rev-parse --short HEAD)
docker build -t $BACKEND_URI:$NEW_TAG .
docker push $BACKEND_URI:$NEW_TAG

# 3. Update the manifest in FifaApp-infra
cd ../FifaApp-infra
sed -i "s|$BACKEND_URI:.*|$BACKEND_URI:$NEW_TAG|" k8s/backend/deployment.yaml
git add k8s/backend/deployment.yaml
git commit -m "Deploy backend:$NEW_TAG"
git push

# 4. Watch ArgoCD apply it — no kubectl needed
kubectl rollout status deployment/fifaapp-backend -n fifaapp
```

This 4-step sequence is exactly what Stage 8 (GitHub Actions) automates.

---

## Key concept: selfHeal

Try breaking the GitOps contract:
```bash
kubectl set image deployment/fifaapp-backend backend=<ECR_BACKEND_URI>:latest -n fifaapp
```

Within ~30 seconds ArgoCD reverts the image back to the SHA tag in git. **Git always wins.**

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

**Next:** Automate steps 2–3 of the loop above with GitHub Actions (Stage 8)
