# Lab 3.2 – Accessing ArgoCD

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

Target service: `argocd-server`

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
Accept TLS warning → **Advanced** → **Proceed**

---

## Part 2: Web UI Access

Login page:
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

**Windows PowerShell:**
```powershell
[System.Text.Encoding]::UTF8.GetString(
  [System.Convert]::FromBase64String(
    (kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}")
  )
)
```

### Validation

Login to UI: `admin` / `QFCJYKEOkBGQVeKM` ✓

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

**Windows PowerShell:**
```powershell
Set-Content -Path .env -Value 'ARGO_CD_PASSWORD=QFCJYKEOkBGQVeKM'
Get-Content .env
```

---

## Part 5: Install ArgoCD CLI

```bash
brew install argocd
```

**Windows (Chocolatey):**
```powershell
choco install argocd-cli -y
```

**Windows (Scoop):**
```powershell
scoop install argocd
```

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

**Output (excerpt):**
```
Available Commands:
  account     Manage account settings
  app         Manage applications
  cluster     Manage cluster credentials
  context     Switch between contexts
  login       Log in to Argo CD
  logout      Log out from Argo CD
  proj        Manage projects
  repo        Manage repository connection parameters
  version     Print version information
```

CLI installed but not connected to any server yet.

---

## Part 7: Account Command Before Login (Expected Error)

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
- Password → value from `.env`

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
- New password → (choose new password)
- Confirm new password

**Output:**
```
Password updated
Context 'localhost:8080' updated
```

Use new password for all future UI and CLI logins.

---

## Part 12: Help Commands

```bash
argocd account help
```

**Output (excerpt):**
```
Available Commands:
  bcrypt          Generate bcrypt hash for any password
  can-i           Can I
  delete-token    Deletes account token
  generate-token  Generate account token
  get             Get account details
  get-user-info   Get user info
  list            List accounts
  update-password Update password
```

```bash
argocd app help
```

**Output (excerpt):**
```
Available Commands:
  create           Create an application
  delete           Delete an application
  diff             Perform a diff against the target and live state.
  get              Get application details
  list             List applications
  sync             Sync an application to its target state
```

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
| Access method | `kubectl port-forward` maps `localhost:8080` → `argocd-server:443` |
| Initial password source | `argocd-initial-admin-secret` secret, Base64-encoded |
| Pre-login CLI error | `"Argo CD server address unspecified"` |
| CLI context | Created on `argocd login`, persists locally |
| Empty app list | Normal — no Applications deployed yet |
| Password change | `argocd account update-password` |
