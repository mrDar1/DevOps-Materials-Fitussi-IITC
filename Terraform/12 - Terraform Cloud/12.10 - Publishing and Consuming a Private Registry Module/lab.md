## Introduction

A few sections ago you built a **networking module** and put it in its own repository to publish it to the **public** registry. Terraform Cloud also offers a **private module registry**. In this lab you publish that module privately, then **consume** it from your VCS repo — replacing the raw `aws_vpc`/`aws_subnet` resources with a module call and **migrating the existing state** into the module using `moved` blocks, all reviewed through a pull request's **speculative plan**.

This lab covers:

- **Publishing to the private registry** — straight from a GitHub repo whose name matches `terraform-<provider>-<name>`, including **private** repos.
- **Consuming a private module** — the registry `source` points at `app.terraform.io/...`; `terraform init` only works while **authenticated** to Terraform Cloud.
- **State migration with `moved`** — moving a standalone VPC and a `for_each` subnet (correct key!) into the module without destroying anything.
- **Reviewing via speculative plan + rebase merge** — confirm "no change to VPC, only a name/tag change to the subnet" before merging.

> 💡 Builds on [12.9](../12.9%20-%20Previewing%20Pull%20Requests%20with%20Speculative%20Plans/lab.md): same `terraform-vcs` repo (it already has the VPC, subnet, and S3 bucket).
> 

## Desired Outcome

By the end you will have:

1. Your **networking module** published to the **Terraform Cloud private registry** (published by **tag**, no-code provisioning off), showing its two pushed tags and usage snippet.
2. **`networking.tf`** rewritten to call the private module (`app.terraform.io/<org>/networking-tf-course/aws`) with one subnet, the raw `aws_vpc`/`aws_subnet` resources removed.
3. Two **`moved`** blocks migrating the existing VPC and subnet into the module — the subnet keyed as `subnet_1`.
4. A pull request whose **speculative plan** shows **1 resource change** (VPC moved with no change; subnet name → `...-subnet_1` and an `access = private` tag added), then **rebase-merged** and applied.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Completed [12.9](../12.9%20-%20Previewing%20Pull%20Requests%20with%20Speculative%20Plans/lab.md).
- Your **networking module repo** from the Modules section, named so it matches the registry format `terraform-aws-networking` (i.e. `terraform-<provider>-<name>`), with at least one **tag** pushed.
- Familiarity with `moved` blocks (the state-manipulation section).

---

## Step-by-Step Guide

### Step 1 — Publish the module to the private registry

In Terraform Cloud, go to the **home page** (not a workspace) → **Registry**.

- Click **Publish → Module**.
- Choose the **GitHub App** (already installed).
- Terraform Cloud **filters repositories** to those matching the required name format `terraform-<provider>-<name>`. Pick your networking module repo (e.g. `terraform-aws-networking`) — your `terraform-course-example...` repo is **not** relevant here.
- Publish **based on tag**. Leave **no-code provisioning off**. Click **Publish module**.

It takes a few seconds to process.

> 💡 Open **Publish module → GitHub App** again and notice your **private** `terraform-course-example...` repo appears in the list — a private registry can publish modules from **private** repositories.
> 

> ✅ Success check: after refreshing, the module page shows the **two tags** you pushed to git, the module info, and a **usage snippet** on the right.
> 

---

### Step 2 — Note the private registry source

On the module page, copy the usage snippet. The `source` is different from a public module — it includes the Terraform Cloud host and your org:

```hcl
module "networking" {
  source  = "app.terraform.io/your-organization/networking-tf-course/aws"
  version = "0.1.1"
  # ... inputs ...
}
```

> ℹ️ Because this is a **private** module, `terraform init` will only succeed while you're **authenticated** to Terraform Cloud. Without auth you'd get an access error.
> 

---

### Step 3 — Replace the raw resources with the module

In **`networking.tf`**, replace the standalone `aws_vpc`/`aws_subnet` with a call to the private module. Keep a **single** subnet and reuse the existing variables:

```hcl
module "networking_tf_course" {
  source  = "app.terraform.io/your-organization/networking-tf-course/aws"
  version = "0.1.1"

  vpc_config = {
    cidr_block = var.vpc_cidr
    name       = "terraform-cloud"
  }

  subnet_config = {
    subnet_1 = {
      cidr_block = var.subnet_cidr
      az         = "eu-west-1a"
    }
  }
}
```

Then **delete** the old `aws_vpc "tf_cloud"` and `aws_subnet "tf_cloud"` resources.

> ℹ️ The `source` already comes from Terraform Cloud, so when copying the doc snippet you only need the **input variables**, not a local `source` path.
> 

---

### Step 4 — Migrate state with `moved` blocks

Without `moved`, Terraform would **destroy** the old resources and **create** new ones inside the module. To migrate the state instead, add `moved` blocks.

To find the module's internal resource names, inspect the installed module under `.terraform/modules` — the VPC is `aws_vpc.this` and the subnet is `aws_subnet.this` (created with `for_each`).

```hcl
moved {
  from = aws_vpc.tf_cloud
  to   = module.networking_tf_course.aws_vpc.this
}

moved {
  from = aws_subnet.tf_cloud
  to   = module.networking_tf_course.aws_subnet.this["subnet_1"]
}
```

**What this does:**

| Block | Meaning |
| --- | --- |
| VPC `moved` | Moves the standalone VPC into the module's `aws_vpc.this`. CIDR + name match → **no infrastructure change**. |
| Subnet `moved` | The module's subnet uses `for_each`, so the target **must include the key** `["subnet_1"]` — moving one subnet to one subnet. |

> ⚠️ Getting the subnet **key** wrong is the classic mistake here. The module iterates `subnet_config`, so the address is `aws_subnet.this["subnet_1"]`, not `aws_subnet.this`.
> 

> 💡 The subnet's **name will change** (the module tags it `<vpc-name>-subnet_1` and adds `access = private`), but the subnet itself isn't recreated. Confirm the AZ of the existing subnet (e.g. `eu-west-1a`) matches the module input so there's no destructive change.
> 

---

### Step 5 — Format and verify locally

```bash
terraform init   # installs the private module (requires TFC auth)
terraform fmt
terraform plan
```

> ✅ The plan should show the VPC **moved with no change** and only the **subnet name/tag** changing — no destroy/create.
> 

---

### Step 6 — Branch off main and open a pull request

You're currently on the `s3` branch from 12.9. Move your work onto a fresh branch cut from an up-to-date `main`:

```bash
git stash                       # set the changes aside
git checkout main
git pull --rebase               # get the latest main
git checkout -b networking-module
git stash pop                   # bring the changes back

git status
git add .
git commit -m "refactor(networking): migrate to private networking module"
git push -u origin networking-module
```

On GitHub, **Compare & pull request → Create pull request**.

---

### Step 7 — Review the speculative plan

After a few seconds the PR shows **pending checks**. When done: **Show all checks → Details** to open Terraform Cloud → **View run details**.

> ✅ Success check: the speculative plan shows **one resource change** — the **VPC moved with no change**, and the **subnet name changing** from `terraform-cloud` to `...-subnet_1` plus an added `access = private` tag.
> 

---

### Step 8 — Rebase-merge and apply

On GitHub, **Merge pull request → Rebase and merge → Confirm rebase and merge**.

> 💡 The author prefers **rebase and merge** over a merge commit for a cleaner history. For long-running branches with many commits, **squash and merge** is another option. Pick what fits your team.
> 

The merge to `main` queues a run in the workspace (**Projects & workspaces** shows one planned change). Open it, **Confirm & Apply**, confirm the plan.

> ✅ Success check: the apply completes. Inspecting the state, you'll see a **new module entry** and the resources now tracked **under the module** — useful for seeing how `moved` blocks relocate resources in state.
> 

> ℹ️ This walkthrough read the module's internals from the locally installed copy under `.terraform/modules`. If the module weren't installed locally, you'd instead consult its **repository** or **documentation** to find the resource names.
> 

---

## Congratulations on Completing the Exercise!

You published your networking module to the Terraform Cloud **private registry**, consumed it from your VCS repo (noting that a private module needs **authentication** to init), and used **`moved` blocks** to migrate an existing VPC and a `for_each` subnet into the module **without destroying** them — getting the subnet **key** right. You reviewed the change through a PR **speculative plan**, **rebase-merged** it, and watched the state reorganize under the new module.

> 🧹 This leaves a **real VPC, subnet, and S3 bucket** in your account. When finished with the Terraform Cloud labs, **destroy** them — `terraform destroy` locally or **Queue destroy plan** from the workspace settings (lab 12.6).
> 
