## Introduction

In the previous lab ([12.1 - Creating a Workspace in Terraform Cloud](../12.1%20-%20Creating%20a%20Workspace%20in%20Terraform%20Cloud/lab.md)) you created a **CLI-driven workspace** that's waiting for configuration. In this lab you connect your **local Terraform CLI** to that workspace and run your first remote operation.

This lab covers three ideas:

- **Authenticating the CLI** — `terraform login` requests an API token from Terraform Cloud and stores it locally so the CLI can talk to the platform.
- **The `cloud` block** — a new block inside `terraform { ... }` that links a local project to a specific organization + workspace.
- **Remote execution, proven** — after `terraform init`, an `apply` runs on a Terraform Cloud agent (different OS, different Terraform patch version) and streams output back to your terminal.

> 💡 Building on lab 12.1: that workspace was waiting for configuration. The `cloud` block *is* that configuration link. Once `init` succeeds, the workspace stops waiting and starts accepting runs.
> 

## Desired Outcome

By the end you will have:

1. Authenticated the Terraform CLI to Terraform Cloud with `terraform login` (token stored locally).
2. A project folder containing a **`provider.tf`** with a `cloud` block pointing at your organization and the `terraform-cli` workspace.
3. The `random` provider declared (`hashicorp/random`, `>= 3.0`).
4. A successful `terraform init` reporting **Terraform Cloud has been initialized**.
5. A successful `terraform apply` that runs **remotely** (no resources yet → "no changes"), proving the integration works.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Terraform CLI installed (`terraform version` to check — the lab author uses `1.7.3` locally).
- The Terraform Cloud **workspace from lab 12.1** (`terraform-cli`) and your **organization name**.
- A browser to generate the API token.

---

## Step-by-Step Guide

### Step 1 — Create the project folder

Create a new folder for this project and change into it. This folder is what gets linked to your Terraform Cloud workspace, so make sure you're inside it before running any commands.

```bash
mkdir terraform-cloud
cd terraform-cloud
```

> ℹ️ The lab author names the folder `18-terraform-cloud` to match their course numbering. The name doesn't matter — just be **inside the correct directory** when you run the commands.
> 

---

### Step 2 — Authenticate with `terraform login`

From inside the folder, run:

```bash
terraform login
```

**What happens:**

- Terraform tells you it will **request an API token** from `app.terraform.io`, open your browser, and **store your credentials** in a local credentials file.
- Type `yes` and press Enter to continue.
- In the browser, Terraform Cloud opens a **Create API token** page. Set an **expiration** (e.g. `30 days` is plenty for this course) and click **Generate Token**.
- **Copy** the token, return to the terminal, and **paste** it at the prompt.

> ℹ️ You won't see anything as you paste — the token is a **sensitive value**, so the input is hidden. Press Enter anyway.
> 

> ✅ Success check: scroll up and you should see a **welcome message from Terraform Cloud**. That means the CLI is authenticated and you can trigger remote runs.
> 

---

### Step 3 — Add the `cloud` block in `provider.tf`

Create a file named **`provider.tf`** (keeping the course convention of putting the `terraform { ... }` block in a file called `provider.tf`). Add the `cloud` block and the required `random` provider:

```hcl
terraform {
  cloud {
    organization = "your-organization" # replace with YOUR organization name

    workspaces {
      name = "terraform-cli" # the workspace created in lab 12.1
    }
  }

  required_providers {
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}
```

**What each part means:**

| Block / argument | Meaning |
| --- | --- |
| `cloud { ... }` | A **new block** (not seen before) that integrates this project with Terraform Cloud. |
| `organization` | The organization that owns the workspace. |
| `workspaces { name = ... }` | The specific workspace to link — here, `terraform-cli` from lab 12.1. |
| `required_providers.random` | Declares the `hashicorp/random` provider so we can create a random ID in the next lab. |
| `version = ">= 3.0"` | Accepts random provider **version 3.0 or newer**. |

> 💡 We add `random` now only so `init` has a provider to install. We don't create any resource yet — that's the next lab.
> 

---

### Step 4 — Format and initialize

Format the config and initialize the project:

```bash
terraform fmt
terraform init
```

**What this does:**

- `terraform fmt` — tidies the file's indentation/alignment to canonical style.
- `terraform init` — installs the `random` provider **and** establishes the Terraform Cloud integration.

> ✅ Success check: the `init` output is now **different** from a normal local init — it reports that **Terraform Cloud has been successfully initialized**. That confirms your credentials are valid and the workspace link works.
> 

---

### Step 5 — Run a remote apply

Trigger a run from the CLI:

```bash
terraform apply
```

**What you'll observe:**

- Messages indicating the run **is executing in Terraform Cloud** and that output is **streamed** to your console.
- A line showing it's **waiting for the plan to start**, then the **remote** Terraform version (e.g. `Terraform v1.7.5`).
- Since there are **no resources defined yet**, the result is **no changes**.

> ℹ️ **Proof it's remote:** the run reports Terraform `v1.7.5` (the workspace's version) while the author's local CLI is `v1.7.3` — a two-patch difference — and the agent runs on **Linux** while the author is on **Mac**. Different version, different machine = it really ran in Terraform Cloud.
> 

---

## Congratulations on Completing the Exercise!

You authenticated the Terraform CLI with `terraform login`, linked your project to a Terraform Cloud workspace using the new `cloud` block, and ran a remote `apply` — confirmed remote by the different Terraform version and operating system. In the next lab you'll add a `random_id` resource and watch Terraform Cloud actually create something.

> 🧹 No billable cloud resources were created — the apply produced **no changes**. Nothing to clean up. (Your local API token remains stored; run `terraform logout` if you want to revoke it.)
> 
