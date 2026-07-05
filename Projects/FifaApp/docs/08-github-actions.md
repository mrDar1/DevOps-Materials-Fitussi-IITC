# Stage 8 — CI/CD with GitHub Actions

## Goal
Automate the 4-step manual loop from Stage 7 Step 6. From now on, a `git push` to an app repo
runs the tests, builds the image, pushes it to ECR with a SHA tag, and updates the manifest in
`FifaApp-infra` — and ArgoCD takes it from there.  
After this stage you never run `docker build`, `docker push`, or `kubectl` to ship code again.

---

## The pipeline

```
push to main ──→ [test] ──→ [build-push] ──→ [update-manifest] ──→ commit to FifaApp-infra
                                                                          │
pull request ──→ [test]  (stops here)                                    ▼
                                                                       ArgoCD ──→ EKS
```

Two identical workflows — one in `FifaApp-backend`, one in `FifaApp-frontend`. GitHub Actions
ends at the git commit; ArgoCD (Stage 7) does the actual deploy. CI never touches the cluster.

---

## What changes

| | Stage 7 (manual) | Stage 8 (automated) |
|--|--|--|
| Run tests | On your laptop, if you remember | Every push and PR, always |
| Build & push image | `docker build` / `docker push` by hand | GitHub Actions job |
| Update manifest | `sed` + `git push` by hand | GitHub Actions job |
| AWS credentials | Your IAM user keys | OIDC — no stored keys |
| Deploy | ArgoCD (unchanged) | ArgoCD (unchanged) |

---

## OIDC — the third time you've seen this pattern

Stage 6 used OIDC twice: the EKS cluster provider (IRSA) and Terraform Cloud → AWS.
GitHub Actions → AWS is provider #3. Same three pieces every time: an **identity provider**,
an **IAM role**, and a **trust policy** that scopes who may assume it.

| | Terraform Cloud (Stage 6) | GitHub Actions (Stage 8) |
|--|--|--|
| Provider URL | `app.terraform.io` | `token.actions.githubusercontent.com` |
| Audience (`aud`) | `aws.workload.identity` | `sts.amazonaws.com` |
| Subject (`sub`) scope | `organization:...:workspace:fifaapp-eks:...` | `repo:<org>/FifaApp-backend:ref:refs/heads/main` |

The `sub` condition is the security boundary: only workflows running on the `main` branch of
your two app repos can get AWS credentials. A PR build — even one containing malicious code —
cannot assume the role.

---

## Step 1 — Create the GitHub OIDC provider and IAM role (Terraform)

In `FifaApp-infra/terraform/`, create `github-oidc.tf`:

```hcl
variable "github_org" {
  description = "GitHub org or username that owns FifaApp-backend and FifaApp-frontend"
  type        = string
}

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only workflows on the main branch of these two repos can assume the role.
    # PR builds never get AWS credentials.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_org}/FifaApp-backend:ref:refs/heads/main",
        "repo:${var.github_org}/FifaApp-frontend:ref:refs/heads/main",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "fifaapp-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role.json
  tags               = { Project = "FifaApp" }
}

# Same ECR push/pull policy the student IAM users got in Stage 6 — nothing more
resource "aws_iam_role_policy_attachment" "github_actions_ecr" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.ecr_access.arn
}

output "gha_role_arn" {
  description = "Set this as the AWS_ROLE_ARN secret in both app repos"
  value       = aws_iam_role.github_actions.arn
}
```

Set `github_org` in the TFC workspace (Variables → Terraform variable, key `github_org`,
value your GitHub org or username), then commit and push — TFC picks it up via VCS,
same flow as Stage 6:

```bash
cd FifaApp-infra
git add terraform/github-oidc.tf
git commit -m "Add GitHub Actions OIDC role"
git push
```

Confirm & Apply in the TFC UI, then grab the role ARN from the outputs:

```
gha_role_arn = "arn:aws:iam::123456789012:role/fifaapp-github-actions"
```

> **Least privilege:** the role reuses `aws_iam_policy.ecr_access` from Stage 6's
> `iam-users.tf` — CI gets exactly the same ECR permissions your student IAM user has,
> and nothing else. No cluster access, no admin.

---

## Step 2 — Create a PAT so CI can push to FifaApp-infra

The automatic `GITHUB_TOKEN` a workflow gets only works **inside its own repo**. The CD job
must push a commit to a *different* repo — `FifaApp-infra` — so it needs a Personal Access Token.

GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
Generate new token**:

- **Repository access:** Only select repositories → `FifaApp-infra`
- **Permissions:** Contents → **Read and write** (nothing else)

Copy the `github_pat_...` value — you'll store it as a secret in the next step.

> **Why a PAT and not a deploy key?** A deploy key means generating SSH key pairs and
> configuring the git remote for SSH. A fine-grained PAT is one `token:` line in the
> workflow. Note the default expiry is **90 days** — when your pipeline suddenly fails
> with 403 three months from now, this is why.

---

## Step 3 — Add secrets to BOTH app repos

Two secrets, same values in both repos:

| Secret | Value | Used by |
|--|--|--|
| `AWS_ROLE_ARN` | `gha_role_arn` output from Step 1 | `build-push` job (OIDC assume-role) |
| `INFRA_REPO_TOKEN` | The PAT from Step 2 | `update-manifest` job (push to FifaApp-infra) |

```bash
ORG=<your-org>
ROLE_ARN="arn:aws:iam::123456789012:role/fifaapp-github-actions"

gh secret set AWS_ROLE_ARN     --repo $ORG/FifaApp-backend  --body "$ROLE_ARN"
gh secret set INFRA_REPO_TOKEN --repo $ORG/FifaApp-backend  --body "github_pat_..."
gh secret set AWS_ROLE_ARN     --repo $ORG/FifaApp-frontend --body "$ROLE_ARN"
gh secret set INFRA_REPO_TOKEN --repo $ORG/FifaApp-frontend --body "github_pat_..."
```

(Or via the UI: repo → **Settings → Secrets and variables → Actions → New repository secret**.)

> **Note:** the region and ECR repo names are plain `env:` values in the workflow file,
> not secrets. Not everything is a secret — only credentials are.

---

## Step 4 — The backend workflow

In `FifaApp-backend`, create `.github/workflows/ci-cd.yml` (the path matters — GitHub only
runs workflows from this exact directory):

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  id-token: write # required for OIDC — lets this run request a token AWS can verify
  contents: read

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: fifaapp-backend

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run tests
        run: pytest tests/ -v

  build-push:
    needs: test
    if: github.event_name == 'push' # PRs stop after tests
    runs-on: ubuntu-latest
    outputs:
      registry: ${{ steps.ecr.outputs.registry }}
      image_tag: ${{ steps.meta.outputs.tag }}
    steps:
      - uses: actions/checkout@v4

      - name: Compute short SHA tag
        id: meta
        run: echo "tag=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push image
        run: |
          IMAGE=${{ steps.ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ steps.meta.outputs.tag }}
          docker build -t "$IMAGE" .
          docker push "$IMAGE"

  update-manifest:
    needs: build-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: <your-org>/FifaApp-infra
          token: ${{ secrets.INFRA_REPO_TOKEN }}

      - name: Update image tag and push
        run: |
          IMAGE=${{ needs.build-push.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ needs.build-push.outputs.image_tag }}
          sed -i "s|image: .*|image: $IMAGE|" k8s/backend/deployment.yaml
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add k8s/backend/deployment.yaml
          git commit -m "Deploy ${ECR_REPOSITORY}:${{ needs.build-push.outputs.image_tag }}"
          git pull --rebase origin main
          git push
```

Replace `<your-org>` in the `update-manifest` checkout, then walk through what each job does:

- **`on:`** — both `push` to main and `pull_request`. The `if: github.event_name == 'push'`
  on `build-push` is what makes PRs test-only: the job (and everything after it) is skipped.
- **`permissions: id-token: write`** — the single line that makes OIDC work. It lets the run
  request a signed token from GitHub that AWS verifies against the trust policy from Step 1.
- **`test`** — the exact `pytest tests/ -v` from Stage 2. No MongoDB needed: the tests mock
  the collection, so there's no service container and no `MONGO_URI`.
- **`build-push`** — `configure-aws-credentials` exchanges the OIDC token for temporary AWS
  credentials (`role-to-assume` — no access keys anywhere). `${GITHUB_SHA::7}` is the CI
  equivalent of Stage 7's `git rev-parse --short HEAD`. The registry and tag are exposed as
  **job outputs** so the next job can read them via `needs.build-push.outputs.*`.
- **`update-manifest`** — checks out the *other* repo using the PAT, then runs the same `sed`
  you ran by hand in Stage 7 Step 6, commits as `github-actions[bot]`, and pushes.
  `git pull --rebase` first, in case the frontend pipeline pushed a moment earlier.

Commit and push:

```bash
cd FifaApp-backend
git add .github/
git commit -m "Add CI/CD workflow"
git push
```

Watch it run in the repo's **Actions** tab, or:

```bash
gh run watch
```

> **If a future stage adds real integration tests** that hit MongoDB, the `test` job would
> need a `services:` block with a mongo container. Today's tests are fully mocked, so it doesn't.

---

## Step 5 — The frontend workflow

Copy the same file into `FifaApp-frontend/.github/workflows/ci-cd.yml` and change exactly
four things:

| | Backend | Frontend |
|--|--|--|
| Runtime setup | `actions/setup-python@v5`, python 3.11, `cache: pip` | `actions/setup-node@v4`, node 20, `cache: npm` |
| Install | `pip install -r requirements.txt` | `npm ci` |
| Tests | `pytest tests/ -v` | `npm run test` |
| Target | `ECR_REPOSITORY: fifaapp-backend`, `k8s/backend/deployment.yaml` | `ECR_REPOSITORY: fifaapp-frontend`, `k8s/frontend/deployment.yaml` |

Full file in `solutions/08-github-actions/frontend/.github/workflows/ci-cd.yml`.

---

## Step 6 — Watch the full loop end-to-end

Make a visible change and push:

```bash
cd FifaApp-backend
# ... edit something ...
git add . && git commit -m "Fix: improve player validation"
git push

gh run watch
```

Then follow the change through each hop:

```bash
# 1. CI committed to the infra repo on your behalf
cd ../FifaApp-infra
git pull && git log -1
```
```
Author: github-actions[bot]
    Deploy fifaapp-backend:a1b2c3d
```

```bash
# 2. ArgoCD picked it up and rolled out
kubectl rollout status deployment/fifaapp-backend -n fifaapp
```
```
deployment "fifaapp-backend" successfully rolled out
```

The ArgoCD UI (Stage 7 Step 5) now shows the new SHA tag on the backend deployment.

> **You just shipped to Kubernetes by running `git push`.** Tests, image build, ECR push,
> manifest update, deploy — zero manual steps. That's the whole point of the course.

---

## Step 7 — Verify the PR path

```bash
cd FifaApp-backend
git checkout -b break-a-test
# ... make a test fail on purpose (e.g. change an expected value in tests/test_health.py) ...
git add . && git commit -m "Test the PR gate"
git push -u origin break-a-test
gh pr create --fill
```

On the PR page: only the `test` job runs — `build-push` and `update-manifest` show as
**Skipped** — and the red ❌ marks the PR as failing. No image was built, no deploy happened.
Fix the test, push again, watch it go green.

> **Optional:** repo → Settings → Branches → add a branch protection rule on `main` requiring
> the `test` check to pass. Now broken code *cannot* be merged.

---

## Why sed and not yq / Kustomize / Image Updater?

| Tool | What it would give you | Why not here |
|--|--|--|
| `sed` | One-line tag swap | ✅ Zero new tools, same command as Stage 7 |
| `yq` | YAML-aware editing | Another binary to install for the same result |
| Kustomize `images:` | Declarative tag overrides | Worth it with many overlays — we have one env |
| ArgoCD Image Updater | Watches ECR, no CI commit step | Great in real teams; hides the loop you're here to learn |

You'll meet the others in real teams — this is a deliberate scope cut, not a best practice claim.

---

## Troubleshooting

| Symptom | Cause | Fix |
|--|--|--|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Trust policy `sub` doesn't match | Check `github_org` spelling and that you pushed to `main` — other branches (and PRs) are rejected by design |
| `remote: Permission denied` / 403 on infra push | PAT missing Contents R/W on FifaApp-infra — or it expired (90 days) | Regenerate the PAT, update `INFRA_REPO_TOKEN` in both repos |
| `non-fast-forward` on infra push | Backend and frontend pipelines finished at the same moment | Re-run the failed job — the `git pull --rebase` handles it next time |
| `nothing to commit` in update-manifest | Re-run of a commit whose tag is already in the manifest | Nothing to deploy — the manifest is already at this SHA |

---

## Verify

- [ ] A PR runs the `test` job only; `build-push` and `update-manifest` are skipped
- [ ] A push to `main` produces a `github-actions[bot]` commit in FifaApp-infra
- [ ] ArgoCD shows **Synced** on the new SHA tag
- [ ] Both app repos' Settings → Secrets show `AWS_ROLE_ARN` and `INFRA_REPO_TOKEN` — and **no** AWS access keys

---

## Stuck? Check the solution
```
solutions/08-github-actions/
```

**Next:** Nothing — the loop is closed. Code push → tests → image → GitOps → cluster,
with no human in the middle.
