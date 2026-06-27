## Introduction

When you connected the repo in [12.7](../12.7%20-%20Connecting%20a%20GitHub%20Repository%20with%20the%20VCS-Driven%20Workflow/lab.md), the **automatic speculative plans on pull requests** option was enabled. In this lab you see it in action: open a **pull request** and Terraform Cloud runs a **speculative plan** — a *plan-only* preview that **cannot be applied** — so you can review the infrastructure change before merging.

This lab covers:

- **Speculative plans** — a plan triggered by a **pull request** that previews the change but **can't be applied**.
- **Where to find it** — surfaced as a **GitHub check** on the PR; the run lives in the workspace **run list**, not as the current run.
- **Merge → real run** — merging the PR pushes to the default branch, which triggers a normal (appliable) run that creates the resource.

> 💡 Building on 12.8: same `terraform-vcs` repo and workspace. This time you push to a **branch** and open a **PR** instead of pushing straight to the default branch.
> 

## Desired Outcome

By the end you will have:

1. A new **`s3.tf`** added on a feature branch (`s3`) defining an `aws_s3_bucket`.
2. A **pull request** that triggers a **GitHub check** from Terraform Cloud → a **speculative plan** you can open and inspect (resource changes, run details).
3. Confirmation that the speculative run is **plan-only** (started from a pull request, **cannot be applied**) and lives in the workspace **run list**.
4. After **merging** the PR, a normal run on the default branch that **creates the S3 bucket**.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Completed [12.8](../12.8%20-%20Triggering%20Runs%20by%20Pushing%20Code%20to%20GitHub/lab.md): the `terraform-vcs` repo cloned locally, with AWS credentials already set on the workspace.
- Git authenticated to GitHub.

---

## Step-by-Step Guide

### Step 1 — Add an S3 bucket (in the new repo)

Make sure you're in the **VCS repo** (not your course repo). Create **`s3.tf`**:

```hcl
resource "aws_s3_bucket" "tf_cloud" {
  bucket = "terraform-cloud-vcs-<random>" # add any random-enough string; S3 names are global
}
```

> ℹ️ S3 bucket names are **globally unique** — append a random number/string so it doesn't collide.
> 

---

### Step 2 — Commit on a feature branch and push

Instead of committing to `main`, create and switch to a new branch, then push it and set the upstream:

```bash
git checkout -b s3
git add .
git status               # confirm only s3.tf is staged
git commit -m "feat(s3): add new bucket"
git push -u origin s3
```

**What this does:**

- `git checkout -b s3` — creates and switches to branch `s3`.
- `git push -u origin s3` — pushes the branch and **sets the upstream** (`-u`) so future pushes are simpler.

---

### Step 3 — Open a pull request

On GitHub you'll see a prompt about the recent push. Click **Compare & pull request**, leave the description as is, and **Create pull request**.

> ℹ️ At this point the **Terraform Cloud console shows nothing new** — speculative runs don't appear as the workspace's current run.
> 

---

### Step 4 — Inspect the speculative plan via the GitHub check

After a few seconds, the PR shows a new **check** from Terraform Cloud.

- Click **Show all checks → Details**.
- You're taken to the **speculative plan** page. Open **Resource changes** and **View run details**.

> ℹ️ This page is **not nested under the workspace's current run** — you reach it through the **check's Details link**. Following it lands you under the workspace, where you can see the plan.
> 

> ⚠️ Scroll down and you'll see this run was **started from a pull request** and **cannot be applied**. The **only purpose** of a speculative plan is to **preview** the changes that *would* happen if the PR were merged into the default branch.
> 

---

### Step 5 — Find the speculative run in the run list

The speculative run is a bit hidden. On the workspace **Runs** page, scroll down: it's **not** the current run (that's the latest run from the default branch) — it sits further down in the **run list**.

> 💡 So speculative plans give you a **history of proposed changes** per PR, and a way to verify the infra change matches what you intend to merge.
> 

---

### Step 6 — Merge to trigger a real run

Back on the GitHub PR, click **Merge pull request** and **Confirm merge**.

Because the merge pushes changes to the **default branch**, Terraform Cloud queues a **normal** run:

- The plan is **queued**, then **executes**, proposing to add the S3 bucket.
- **Confirm & Apply** and wait for completion.

> ✅ Success check: the run completes and your `aws_s3_bucket` is created. Unlike the speculative plan, **this** run could be applied.
> 

---

## Congratulations on Completing the Exercise!

You used **speculative plans** to preview a Terraform change from a **pull request** — a plan-only run that **can't be applied**, surfaced as a GitHub check and tucked into the workspace run list. After reviewing it, you **merged** the PR, which triggered a real run on the default branch that created the S3 bucket. Speculative plans give you a per-PR history of proposed changes and a safety check that the infrastructure change matches what you're about to merge.

> 🧹 This lab creates a **real S3 bucket** (plus the VPC/subnet from 12.8). When done with the VCS labs, destroy everything — `terraform destroy` locally, or **Queue destroy plan** from the workspace settings (lab 12.6).
> 
