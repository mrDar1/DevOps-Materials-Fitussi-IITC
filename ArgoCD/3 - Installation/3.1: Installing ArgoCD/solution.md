# Lab 3.1 – ArgoCD Installation & Access

## Prerequisites: Install ArgoCD (Helm)

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
```

```bash
helm upgrade argocd argo/argo-cd \
  --version 8.6.0 \
  --install \
  --namespace argocd \
  --create-namespace
```

**Output:** `Release "argocd" does not exist. Installing it now.` → STATUS: deployed

---

## Part 1: Expose ArgoCD Server via Port Forward

### Check services

```bash
kubectl get svc -n argocd
```

**Output:**
```
NAME                               TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)
argocd-applicationset-controller   ClusterIP   10.105.91.126    <none>        7000/TCP
argocd-dex-server                  ClusterIP   10.97.251.3      <none>        5556/TCP,5557/TCP
argocd-redis                       ClusterIP   10.108.64.66     <none>        6379/TCP
argocd-repo-server                 ClusterIP   10.109.167.218   <none>        8081/TCP
argocd-server                      ClusterIP   10.104.97.122    <none>        80/TCP,443/TCP
```

### Start port-forward (keep terminal open)

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

**Output:**
```
Forwarding from 127.0.0.1:8080 -> 8080
Forwarding from [::1]:8080 -> 8080
```

### Validation

Open browser → `https://localhost:8080`  
Accept security warning → click **Advanced** → **Proceed**

---

## Part 2: Web UI Access

Login page credentials:
- **Username:** `admin`
- **Password:** retrieved in Part 3

---

## Part 3: Retrieve Initial Admin Password

```bash
kubectl get secret argocd-initial-admin-secret \
  -n argocd \
  -o jsonpath="{.data.password}" | base64 --decode
```

**Output:**
```
QFCJYKEOkBGQVeKM
```

### Validation

Login to UI with `admin` / `QFCJYKEOkBGQVeKM` ✓

---

## Part 4: Save Password to .env File

```bash
echo 'ARGO_CD_PASSWORD=QFCJYKEOkBGQVeKM' > .env
cat .env
```

**Output:**
```
ARGO_CD_PASSWORD=QFCJYKEOkBGQVeKM
```

---

## Part 5: Install ArgoCD CLI

```bash
brew install argocd
```

**Output:** `argocd 3.4.4` installed to `/opt/homebrew/Cellar/argocd/3.4.4`

---

## Part 6: Verify CLI Installation

```bash
which argocd
```

**Output:** `/opt/homebrew/bin/argocd`

```bash
argocd version
```

**Output:**
```
argocd: v3.4.4+443415b.dirty
  BuildDate: 2026-06-18T12:14:39Z
  GitCommit: 443415b5527ac55366e0760c93ef0e1abd0cf273
  Platform: darwin/arm64
```

```bash
argocd help
```

**Output:** Lists all available argocd subcommands.

---

## Part 7: Account Commands Before Login (Expected Error)

```bash
argocd account get-user-info
```

**Output (error — expected):**
```
{"level":"fatal","msg":"Argo CD server address unspecified"}
```

CLI has no server context yet.

---

## Part 8: Login to ArgoCD via CLI

> Port-forward must be running (Part 1)

```bash
argocd login localhost:8080
```

Interactive prompts:
- Confirm insecure connection → `y`
- Username → `admin`
- Password → `QFCJYKEOkBGQVeKM`

Or non-interactive:
```bash
argocd login localhost:8080 --username admin --password QFCJYKEOkBGQVeKM --insecure
```

**Output:**
```
'admin:login' logged in successfully
Context 'localhost:8080' updated
```

---

## Part 9: Check Context

```bash
argocd context
```

**Output:**
```
CURRENT  NAME            SERVER
*        localhost:8080  localhost:8080
```

---

## Part 10: Get Logged-In User Info

```bash
argocd account get-user-info
```

**Output:**
```
Logged In: true
Username: admin
Issuer: argocd
Groups:
```

---

## Part 11: Change Admin Password

```bash
argocd account update-password
```

Interactive prompts:
- Current password → `QFCJYKEOkBGQVeKM`
- New password → `Admin1234!`
- Confirm new password → `Admin1234!`

Or non-interactive:
```bash
argocd account update-password \
  --current-password QFCJYKEOkBGQVeKM \
  --new-password Admin1234!
```

**Output:**
```
Password updated
Context 'localhost:8080' updated
```

Use `Admin1234!` for all future logins (UI + CLI).

---

## Part 12: Help Commands

```bash
argocd account help
```

```bash
argocd app help
```

Both return list of available subcommands for `account` and `app` resources.

---

## Part 13: List Applications

```bash
argocd app list
```

**Output:**
```
NAME  CLUSTER  NAMESPACE  PROJECT  STATUS  HEALTH  SYNCPOLICY  CONDITIONS  REPO  PATH  TARGET
```

Empty list — expected. No Applications deployed yet.

---

## Cleanup

Stop port-forward:
```
Ctrl+C
```

---

## Key Takeaways

| Concept | Detail |
|---------|--------|
| ArgoCD server service | `argocd-server` (ClusterIP, ports 80/443) |
| Initial admin secret | `argocd-initial-admin-secret` in `argocd` namespace |
| Password encoding | Base64 — decode with `base64 --decode` |
| CLI context | Created on `argocd login`, stored locally |
| Pre-login CLI error | `"Argo CD server address unspecified"` |
| Post-login | Context `localhost:8080` active |
| Empty app list | Normal — no Applications deployed yet |
