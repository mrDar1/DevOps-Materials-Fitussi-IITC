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

In `FifaApp-infra/terraform/`, create a new Terraform file called `github-oidc.tf`.

This file should:
- Define an input variable for your GitHub organization name
- Fetch the TLS certificate from GitHub's OIDC provider endpoint
- Create an AWS IAM OIDC provider that trusts `token.actions.githubusercontent.com`
- Create an IAM policy document that allows workflows to assume a role, with conditions that:
  - Validate the audience is `sts.amazonaws.com`
  - Restrict access to only workflows running on the `main` branch of `FifaApp-backend` and `FifaApp-frontend`
  - Explicitly deny credentials to PR builds (they run on non-main branches)
- Create an IAM role for GitHub Actions that uses this assume role policy
- Attach the same ECR access policy that student IAM users received in Stage 6
- Output the role ARN so you can use it as a secret in the app repositories

Set the `github_org` Terraform variable in your Terraform Cloud workspace using the web UI, then commit and push your new file. This follows the same VCS-driven flow as Stage 6. Apply the changes in the TFC UI and copy the `gha_role_arn` output — you'll need it in Step 3.

> **Least privilege:** the role reuses `aws_iam_policy.ecr_access` from Stage 6's
> `iam-users.tf` — CI gets exactly the same ECR permissions your student IAM user has,
> and nothing else. No cluster access, no admin.

---

## Step 2 — Create a Personal Access Token (PAT) for CI to push to FifaApp-infra

The automatic `GITHUB_TOKEN` that GitHub Actions provides only works **inside the repository where the workflow runs**. Since the CD job must commit and push to a *different* repository (`FifaApp-infra`), you need a Personal Access Token.

Create a fine-grained Personal Access Token through your GitHub settings:
- Scope it to only the `FifaApp-infra` repository
- Grant it **Contents** permission with **Read and write** access
- Do not grant any other permissions

Copy the generated token value (it will start with `github_pat_`). You'll store this as a secret in the next step.

> **Why a PAT and not a deploy key?** A deploy key requires SSH setup and changing git remotes. A fine-grained PAT requires only one environment variable in the workflow. Note the default expiry is **90 days** — plan ahead for token rotation when your pipeline starts failing with 403 errors after 90 days.

---

## Step 3 — Add secrets to BOTH app repos

Add the following secrets to both `FifaApp-backend` and `FifaApp-frontend` repositories:

| Secret Name | Value | Purpose |
|--|--|--|
| `AWS_ROLE_ARN` | The role ARN output from Step 1 | Used by the build job to assume the GitHub Actions role via OIDC |
| `INFRA_REPO_TOKEN` | The PAT you created in Step 2 | Used by the manifest update job to push commits to FifaApp-infra |

You can add these secrets through:
- The GitHub CLI: `gh secret set` for each secret in each repo
- The UI: Navigate to repository **Settings → Secrets and variables → Actions → New repository secret**

The values must be identical across both repositories.

> **Note:** AWS region and ECR repository names are not secrets — they're environment variables defined in the workflow file itself. Only store actual credentials as secrets.

---

## Step 4 — The backend workflow

In `FifaApp-backend`, create a new GitHub Actions workflow file at `.github/workflows/ci-cd.yml` (the exact path is required — GitHub only runs workflows from this directory).

This workflow should trigger on both `push` to `main` and `pull_request` to `main`.

**Workflow structure:**

The workflow should include three jobs:

1. **`test` job:** 
   - Check out the repository
   - Set up Python 3.11 environment with pip caching
   - Install dependencies from requirements.txt
   - Run the test suite using pytest with verbose output
   - This job runs for both pushes and pull requests

2. **`build-push` job:**
   - Depends on the `test` job completing successfully
   - Only runs on `push` events (PRs skip this job)
   - Check out the repository
   - Compute a short SHA tag (first 7 characters of `GITHUB_SHA`) to identify the image
   - Configure AWS credentials using OIDC (use the `AWS_ROLE_ARN` secret and `us-east-1` region)
   - Login to ECR
   - Build a Docker image and push it to ECR with the short SHA tag
   - Output the registry URL and image tag for the next job to use

3. **`update-manifest` job:**
   - Depends on `build-push` completing successfully
   - Check out the `FifaApp-infra` repository (not the app repo) using the `INFRA_REPO_TOKEN` secret
   - Update the `k8s/backend/deployment.yaml` file to use the new image tag from the previous job
   - Configure git with the bot identity
   - Commit the manifest update
   - Pull with rebase before pushing to handle concurrent frontend pipeline updates
   - Push the commit back to FifaApp-infra

**Key requirements:**
- Grant the workflow `id-token: write` permission for OIDC to work
- Define environment variables for `AWS_REGION` (us-east-1) and `ECR_REPOSITORY` (fifaapp-backend)
- Replace `<your-org>` with your actual GitHub organization in the checkout step

Commit this workflow file to the repository and push it. You can watch it run in the **Actions** tab.

> **If a future stage adds real integration tests** that hit MongoDB, the `test` job would need a `services:` block with a mongo container. Today's tests are fully mocked, so it doesn't.

---

## Step 5 — The frontend workflow

Create the same workflow in `FifaApp-frontend/.github/workflows/ci-cd.yml`, but adapt it for the Node.js/frontend stack:

| Component | Backend | Frontend |
|--|--|--|
| Runtime setup | Python 3.11 with pip caching | Node 20 with npm caching |
| Install command | `pip install -r requirements.txt` | `npm ci` |
| Test command | `pytest tests/ -v` | `npm run test` |
| ECR repository name | `fifaapp-backend` | `fifaapp-frontend` |
| Manifest file | `k8s/backend/deployment.yaml` | `k8s/frontend/deployment.yaml` |

Otherwise, the three-job structure, permissions, secrets, and OIDC configuration remain identical to the backend workflow.

---

## Step 6 — Watch the full loop end-to-end

Make a visible change to the FifaApp-backend code (for example, update player validation logic or a comment), commit it with a descriptive message, and push to the main branch.

**Follow the change through the pipeline:**

1. **Monitor the workflow run:** Watch the GitHub Actions workflow execute in the repository's **Actions** tab. Observe that the test, build-push, and update-manifest jobs all complete successfully.

2. **Verify the infra repo received the commit:** Pull the latest changes from the FifaApp-infra repository and check the git log. You should see a recent commit from the `github-actions[bot]` user with a message indicating the new image tag (e.g., "Deploy fifaapp-backend:abc1234").

3. **Check ArgoCD deployment:** Use kubectl to verify the deployment rolled out successfully in the `fifaapp` namespace. The backend deployment should show that it's synced to the new image.

4. **Verify in ArgoCD UI:** The ArgoCD dashboard (from Stage 7) should display the updated SHA tag on the backend application.

> **You just shipped to Kubernetes by running `git push`.** Tests, image build, ECR push, manifest update, and deployment all happened automatically — zero manual steps. That's the goal of this course.

---

## Step 7 — Verify the PR path

Create a test branch and intentionally break a test (e.g., modify an expected value in a test file). Commit the change and push the branch. Create a pull request against main.

**Observe the PR workflow:**

On the PR page, verify that:
- Only the `test` job runs
- The `build-push` and `update-manifest` jobs show as **Skipped** because the workflow detected it's a PR, not a push
- The test job fails (red ❌), marking the PR as failing
- No Docker image was built or pushed to ECR
- No commit was made to FifaApp-infra

Fix the test (revert your intentional break), push the fix to the same branch, and watch the PR automatically re-run and go green.

**Optional security enhancement:** Configure a branch protection rule on `main` in the repository settings to require the `test` check to pass before allowing merges. This prevents broken code from reaching production.

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

**Next:** Add observability with Prometheus and Grafana (Stage 9)
