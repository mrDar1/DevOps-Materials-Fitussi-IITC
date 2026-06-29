# Lab 3.1 – Installing ArgoCD

## Part 1: Add Argo Helm Repository

```bash
helm repo add argo https://argoproj.github.io/argo-helm
```

```bash
helm repo update
```

---

## Part 2: Search Chart Versions

```bash
helm search repo argo/argo-cd --versions
```

**Expected:** List of versions — verify `8.6.0` exists.

---

## Part 3: Create Namespace

```bash
kubectl create namespace argocd
```

Or via YAML (`argo-install.yaml`):

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: argocd
```

```bash
kubectl apply -f .
```

### Verify

```bash
kubectl get namespaces
```

**Expected:** `argocd` namespace listed with STATUS `Active`.

---

## Part 4: Install ArgoCD via Helm

```bash
helm upgrade argocd argo/argo-cd \
  --version 8.6.0 \
  --install \
  --namespace argocd \
  --create-namespace
```

**Output:**
```
Release "argocd" does not exist. Installing it now.
NAME: argocd
LAST DEPLOYED: Mon Jun 29 23:12:22 2026
NAMESPACE: argocd
STATUS: deployed
REVISION: 1
```

---

## Part 5: Verify Pods Running

```bash
kubectl get pods -n argocd
```

**Expected output:**
```
NAME                                                READY   STATUS    RESTARTS   AGE
argocd-application-controller-0                     1/1     Running   0          ...
argocd-applicationset-controller-584b54cbf9-cckl7   1/1     Running   0          ...
argocd-dex-server-5f6f85b49c-njd7r                  1/1     Running   0          ...
argocd-notifications-controller-5db5d88994-c9876    1/1     Running   0          ...
argocd-redis-646d9d9648-9cfg8                        1/1     Running   0          ...
argocd-repo-server-58cbc64bd6-7zt8j                 1/1     Running   0          ...
argocd-server-798cfb9d4-7jgrc                        1/1     Running   0          ...
```

All pods `Running` = success. A `Completed` pod is normal (one-time init job).

---

## Cleanup (Optional)

```bash
helm uninstall argocd -n argocd
kubectl delete namespace argocd
```

---

## Key Takeaways

- `upgrade --install` = idempotent, safe to re-run
- Pinning `--version 8.6.0` prevents compatibility issues
- Dedicated namespace = best practice for isolation
- `Completed` pod status is not an error
