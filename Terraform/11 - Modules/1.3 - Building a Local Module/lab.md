## Introduction

So far you have consumed **public** modules from the Terraform Registry. In this lab you flip roles and **author your own local module** — a reusable networking module — applying the module best practices discussed earlier.

This is the first part of a larger journey:

1. **Now:** build a **local** networking module and call it from a root configuration.
2. **Later:** publish the module to the **Terraform public registry**.
3. **Later:** migrate the root config from the **local** module to the **remote** (registry) module.

The goal is to understand:

- **What makes a module** — the standard file structure (`README`, `LICENSE`, `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`).
- **Abstraction** — hide implementation detail (IGW, route tables, associations) behind a simple interface so users just say "make this subnet public".
- **Local module sources** — calling a module by relative path (`./modules/networking`).
- **Input validation** — catch bad input at **plan** time with a `validation` block instead of failing later at the AWS API.

> 💡 A module is just Terraform code in a folder. Authoring one is the same skill as consuming one — you just write the resources, variables, and outputs yourself.
>

## Desired Outcome

By the end you will have:

1. A new root folder `local-modules` (created at the **root** of your Terraform projects, **not** inside another lab folder).
2. A module under `modules/networking/` with the **standard structure**: `README.md`, `LICENSE`, `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`.
3. The module's `versions.tf` declaring the required **AWS provider** (`>= 5.0`).
4. A `vpc_cidr` input **variable** (required, type `string`) with a **validation** rule that rejects invalid CIDR blocks.
5. A root configuration (`providers.tf` + `networking.tf`) that calls the local module via a **relative source**.
6. A clean `terraform plan` that shows **no changes yet** (resources come in the next lab) once a valid CIDR is supplied.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.
>

## Prerequisites

- Terraform `~> 1.7` and AWS credentials configured.
- The earlier **`06-resources`** networking code as a reference (VPC, public subnet, internet gateway, public route table, route table association). The module abstracts exactly this.

---

## Step-by-Step Guide

### Step 1 — Create the root module folder

Create a new folder at the **root** of your Terraform projects (not nested inside another lab):

```
local-modules/
```

This is the **root module** — the directory where you'll run `terraform` commands. The reusable module will live in a subfolder.

---

### Step 2 — Write a README defining the module

Before writing code, define what the module should do. Create `local-modules/README.md` (you'll also add one inside the module folder later).

**`README.md`**

```markdown
# Networking Module

A networking module that should:

- Create a VPC with a given CIDR block.
- Allow the user to provide the configuration for multiple subnets.
  - The user should be able to mark a subnet as **public** or **private**.
  - The user should be able to provide the subnet **CIDR blocks**.
  - The user should be able to provide the AWS **availability zone** for the subnet.
```

**Why this matters:**

- The description looks simple, but look at the `06-resources/networking.tf` reference: a **public** subnet isn't just a subnet — it also needs an **internet gateway**, a **route table**, the route table **associated with the IGW**, and the route table **associated with the subnet**.
- All of that implementation detail is what we **abstract behind the module**. Users shouldn't have to know what makes a subnet "public" — they just flag it `public` and the module wires up the rest. That's where modules earn their usability.

---

### Step 3 — Create the standard module structure

Create the module folder and its files:

```
local-modules/
└── modules/
    └── networking/
        ├── README.md
        ├── LICENSE
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        └── versions.tf
```

**About each file (standard module layout):**

- `README.md` — documents the module's purpose and usage.
- `LICENSE` — the license for the module. We'll populate it later (needed before publishing to the registry).
- `main.tf` — the resources the module creates.
- `variables.tf` — the module's inputs.
- `outputs.tf` — the module's outputs.
- `versions.tf` — the `terraform` / `required_providers` block. (Some authors name it `providers.tf` because it describes the file's content more clearly — either is fine.)

> ℹ️ `README` and `LICENSE` can stay empty for now; we'll fill them before publishing.
>

---

### Step 4 — Declare required providers in the module's `versions.tf`

From the **module's** perspective the Terraform CLI version isn't important — the module just creates resources that depend on the **AWS provider**. So declare only the provider requirement.

**`modules/networking/versions.tf`**

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}
```

**What this does:**

- Declares that this module needs the AWS provider at **version 5.0 or greater**.
- A module declares its provider **constraints**, but it does **not** configure the provider (no region etc.) — the **root** module does that. (You saw this in the public-module labs.)

---

### Step 5 — Add the `vpc_cidr` variable with validation

Add a required input for the VPC CIDR and validate it early.

**`modules/networking/variables.tf`**

```hcl
variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC."

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "The variable vpc_cidr must contain a valid CIDR block."
  }
}
```

**What this does:**

- `type = string`, **no `default`** → the user is **required** to provide a value.
- The `validation` block runs at **plan** time:
  - `cidrnetmask(var.vpc_cidr)` errors if the string isn't a valid CIDR.
  - `can(...)` wraps that, turning the error into `true`/`false` for the `condition`.
  - If the condition is false, Terraform shows the `error_message`.
- This catches a bad CIDR **early** (during planning) instead of waiting for the **AWS API** to reject it during apply.

---

### Step 6 — Format the nested files with `fmt -recursive`

Change into the root folder and format. Because files live in **nested** directories, you must use `-recursive`.

```bash
cd local-modules
terraform fmt -recursive
```

**Note:** plain `terraform fmt` only formats the **current** directory — it leaves the files under `modules/networking/` untouched. `terraform fmt -recursive` reaches into the nested directories too.

---

### Step 7 — Configure the root provider

Create the root `providers.tf` with the same `required_providers` block plus the actual provider configuration (region).

**`providers.tf`**

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = "eu-west-1"
}
```

- The **root** module configures the provider (region) — the module only declared the constraint.
- Use whatever region you've been working in; the lab uses `eu-west-1`.

---

### Step 8 — Call the local module

Create `networking.tf` in the root (the filename is arbitrary — `networking` just signals what's inside). Call the module via a **local/relative source**.

**`networking.tf`**

```hcl
module "networking" {
  source = "./modules/networking"

  vpc_cidr = "10.0.0.0/16"
}
```

**Notes:**

- The **module label** (`module "networking"`) does **not** have to match the module's folder name — it could be `module "vpc"`. There's no relationship between the two.
- `source = "./modules/networking"` is a **local source** — a relative path to the module folder.
- As soon as you set `source`, Terraform recognises that the **required** attribute `vpc_cidr` must be provided (your editor flags it if it's missing).

---

### Step 9 — See validation catch a bad CIDR (optional experiment)

To watch the validation work, temporarily set an **invalid** CIDR:

```hcl
module "networking" {
  source   = "./modules/networking"
  vpc_cidr = "not-a-cidr"
}
```

Then run the workflow:

```bash
terraform fmt -recursive
terraform init     # required: a new module must be installed
terraform plan
```

**What you'll observe:**

- `terraform plan` **before** `init` errors, telling you the module must be installed — adding a module is like adding a provider, so you must run `terraform init` to install it. (You also need `init` here anyway because the config was never initialized — installing the AWS provider, e.g. v5.41.)
- After `init`, `terraform plan` fails with: **"The variable vpc_cidr must contain a valid CIDR block."** — your `validation` rule firing at plan time.
- **Without** the validation block, `plan` would pass and Terraform would try to create the VPC — then the **AWS API** would reject the bad CIDR during apply. The validation catches it earlier and more clearly.

> 💡 Quick aside: if you run `terraform plan` with the module call **removed**, you'll see **no changes** — Terraform only looks at the **current/root** directory. Code sitting under `modules/` does nothing until it's actually **called** as a module. Nested infrastructure must be included via a `module` block.
>

---

### Step 10 — Supply a valid CIDR and plan

Set a valid CIDR and re-plan:

```hcl
module "networking" {
  source   = "./modules/networking"
  vpc_cidr = "10.0.0.0/16"
}
```

```bash
terraform plan
```

**Expected:** the plan succeeds with **no changes** — the module doesn't create any resources **yet** (no resources are defined in `main.tf` so far). You'll build the VPC and subnets in the **next** lab.

> ✅ Success check: `terraform validate` passes, and `terraform plan` reports **no changes** with a valid `vpc_cidr`. The structure (`modules/networking/` with the six standard files) is in place.
>

---

## Congratulations on Completing the Exercise!

You scaffolded your **own local module** with the standard file structure, declared its provider requirement, added a **validated** input variable, and called it from a root configuration via a **local source**. You also saw how validation catches bad input at **plan** time and how Terraform ignores code that isn't called as a module. Next, you'll implement the actual VPC and subnet resources inside the module.
