## Introduction

In [12.7](../12.7%20-%20Connecting%20a%20GitHub%20Repository%20with%20the%20VCS-Driven%20Workflow/lab.md) you connected a GitHub repo to the `terraform-vcs` workspace using the **Version Control Workflow**. Now you'll actually use it: clone the repo, add Terraform code, and **push** — watching Terraform Cloud trigger runs automatically from commits to the default branch.

This lab covers:

- **The VCS loop** — push to the default branch → Terraform Cloud automatically starts a run.
- **Workspace-scoped variables** — both **Terraform variables** (CIDRs) and **AWS credential environment variables** must be set on **this** workspace; the ones from the CLI workspace are **not** shared (no variable set).
- **A deliberate credentials error** — the first run fails with `No valid credential sources found` until you add AWS creds to the VCS workspace.
- **Auto-apply** — where you'd enable automatic approval of VCS/CLI/API runs.

> 💡 Building on 12.7: the repo currently has only README, `.gitignore`, and a license. You'll add a VPC, then a subnet, in two separate pushes.
> 

## Desired Outcome

By the end you will have:

1. The VCS repo cloned **as a sibling** of your course repo, with `provider.tf` (cloud block → `terraform-vcs`, AWS provider, no random provider), `variables.tf`, and `networking.tf`.
2. An `aws_vpc` driven by `var.vpc_cidr`, with the `vpc_cidr` Terraform variable and **AWS credential env vars** added to the `terraform-vcs` workspace.
3. The first **push** → run that initially **errors** on missing credentials, then succeeds after you add them; the VPC is created.
4. A second **push** adding an `aws_subnet` (`var.subnet_cidr`) that **automatically triggers** a run on the default branch and creates the subnet.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Completed [12.7](../12.7%20-%20Connecting%20a%20GitHub%20Repository%20with%20the%20VCS-Driven%20Workflow/lab.md): the GitHub repo connected to the `terraform-vcs` workspace.
- The AWS access key / secret you used in [12.4](../12.4%20-%20Authenticating%20to%20AWS%20with%20Environment%20Variables%20and%20Creating%20an%20S3%20Bucket/lab.md) (you'll add them to *this* workspace too).
- Git installed and authenticated to GitHub.

---

## Step-by-Step Guide

### Step 1 — Clone the repo as a sibling of your course repo

Clone the VCS repository **next to** (a sibling of) your course repository, not inside it.

```bash
# from the directory that contains your course repo
git clone <your-terraform-cloud-repo-url>
cd <your-terraform-cloud-repo>
```

> ℹ️ Listing the parent directory should show your **course repo**, the **new Terraform Cloud repo**, and your **module repo** side by side.
> 

---

### Step 2 — Add the provider configuration

Create **`provider.tf`**. You can reuse the config from the CLI lab (folder `12 - Terraform Cloud`), with two changes: **remove the random provider** (not needed here) and point the `cloud` block at the **`terraform-vcs`** workspace:

```hcl
terraform {
  cloud {
    organization = "your-organization"

    workspaces {
      name = "terraform-vcs"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.0"
    }
  }
}

provider "aws" {
  region = "eu-west-1" # use whatever region is relevant for you
}
```

---

### Step 3 — Add a VPC and its variable

Create **`networking.tf`** with a VPC whose CIDR comes from a variable:

```hcl
resource "aws_vpc" "tf_cloud" {
  cidr_block = var.vpc_cidr

  tags = {
    Name = "terraform-cloud"
  }
}
```

Create **`variables.tf`** declaring the variable — **no default on purpose**, because you'll supply it from Terraform Cloud:

```hcl
variable "vpc_cidr" {
  type = string
}
```

Format the code:

```bash
terraform fmt
```

---

### Step 4 — Commit and push (first run)

```bash
git add .
git commit -m "add VPC"
git push
```

Return to Terraform Cloud and refresh.

> ℹ️ The **very first** push may not auto-trigger a run because the workspace isn't fully configured yet. Terraform Cloud offers **Start a new plan** and the chance to **configure variables** first.
> 

---

### Step 5 — Add the Terraform variable, then run

Click **Configure variables** and add the Terraform variable:

- Key: `vpc_cidr`, Value: `10.0.0.0/16`. Add variable.

Go to **Overview** and **trigger a new run** from the UI.

> ⚠️ **This run will fail** — and that's expected. You set the AWS credentials at the **workspace level** for the *CLI* workspace and did **not** create a **variable set**, so they are **not shared** with `terraform-vcs`. The run errors with:
>
> ```
> No valid credential sources found
> ```

---

### Step 6 — Add AWS credentials to this workspace, re-run

In the `terraform-vcs` workspace → **Variables**, add the two **environment variables** (mark both **sensitive**), exactly as in [12.4](../12.4%20-%20Authenticating%20to%20AWS%20with%20Environment%20Variables%20and%20Creating%20an%20S3%20Bucket/lab.md):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Then **Overview → New run → Start**.

> ✅ Success check: the plan now goes through (credentials work). **Confirm & Apply** and the VPC is created.
> 

---

### Step 7 — Add a subnet and push again (auto-triggered run)

Now prove that a plain `git push` triggers a run. Add a subnet that lives in the VPC.

**`variables.tf`** — add:

```hcl
variable "subnet_cidr" {
  type = string
}
```

**`networking.tf`** — add:

```hcl
resource "aws_subnet" "tf_cloud" {
  vpc_id     = aws_vpc.tf_cloud.id
  cidr_block = var.subnet_cidr

  tags = {
    Name = "terraform-cloud"
  }
}
```

Format and commit (but don't push yet):

```bash
terraform fmt
git add .
git commit -m "add subnet"
```

**Before pushing**, add the matching Terraform variable in Terraform Cloud so the run doesn't error:

- Key: `subnet_cidr`, Value: `10.0.0.0/24`. Add variable.

Now push:

```bash
git push
```

Back in Terraform Cloud → **Overview**, refresh.

> ✅ Success check: the push **automatically triggered a run** — because it's a push to the repo's **default branch**. Open it: the plan **adds a subnet**. Confirm & Apply.
> 

> 💡 In **Settings** you can enable **Auto-apply** for API, CLI, and VCS runs so you don't approve manually. Whether to do that depends on your project/org processes — just know the option exists.
> 

---

## Congratulations on Completing the Exercise!

You drove the **Version Control Workflow** end to end: pushes to the default branch automatically triggered Terraform Cloud runs. You learned that **variables and credentials are workspace-scoped** — the CLI workspace's AWS creds weren't shared (no variable set), so the first run failed with `No valid credential sources found` until you added them here. You created a VPC, then a subnet via a second push, and saw where **auto-apply** lives.

> 🧹 This lab creates a **real VPC and subnet** (free tier, but still real). When done with the VCS labs, **destroy** these resources — e.g. enable **Allow destroy plans** and **Queue destroy plan** in the workspace settings (lab 12.6), or `terraform destroy` locally.
> 
