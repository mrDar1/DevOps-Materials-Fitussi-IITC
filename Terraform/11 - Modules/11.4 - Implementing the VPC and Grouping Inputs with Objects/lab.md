## Introduction

This lab continues building the **local networking module** from **Lab 1.3**. Here you:

1. **Implement the VPC** resource inside the module and deploy it.
2. **Refactor the inputs** — collapse the separate `vpc_cidr` and `vpc_name` variables into a single **`vpc_config` object** variable.

The goal is to understand:

- **Implementing module resources** — wiring a module variable into an `aws_resource`.
- **Object-typed variables** — grouping related inputs under one structured variable instead of many top-level primitives.
- **Module interface & versioning** — why changing a module's input shape is a **breaking change** (major version bump) for published modules.

> 💡 Best practice introduced here: think in terms of **object attributes**, not a pile of primitives at the top level. Group inputs logically by the part of the module they touch.
>

## Desired Outcome

By the end you will have:

1. A `vpc.tf` file inside the module defining an `aws_vpc` that uses the input CIDR and a `Name` tag.
2. A deployed VPC named `local-modules`.
3. The module's inputs refactored from two primitives (`vpc_cidr`, `vpc_name`) into **one** `vpc_config` **object** with `cidr_block` and `name`.
4. The validation moved onto the object's `cidr_block` attribute.
5. A clean `terraform plan` showing **no changes** after the refactor (interface-only change).

> Try it yourself first. Only open the step-by-step if you get stuck.
>

## Prerequisites

- Completed **Lab 1.3** (the scaffolded local module with `vpc_cidr` + validation).
- Terraform `~> 1.7` and AWS credentials configured.

---

## Step-by-Step Guide

### Step 1 — Create `vpc.tf` and define the VPC

Inside the module (`modules/networking/`), create a dedicated `vpc.tf` instead of putting the resource in `main.tf`.

**`modules/networking/vpc.tf`**

```hcl
resource "aws_vpc" "this" {
  cidr_block = var.vpc_cidr

  tags = {
    Name = var.vpc_name
  }
}
```

**What this does:**

- `cidr_block = var.vpc_cidr` — feeds the module's input CIDR into the VPC.
- The `Name` tag uses a new `vpc_name` input (added next).

---

### Step 2 — Add the `vpc_name` variable

Add the new variable to the module (we'll refactor it away shortly — this is intentional, to show the "before").

**`modules/networking/variables.tf`** (add)

```hcl
variable "vpc_name" {
  type = string
}
```

---

### Step 3 — Pass `vpc_name` from the root and apply

In the root `networking.tf`, pass the new argument.

**`networking.tf`**

```hcl
module "networking" {
  source = "./modules/networking"

  vpc_cidr = "10.0.0.0/16"
  vpc_name = "local-modules"
}
```

Then deploy:

```bash
terraform init    # ensure everyone's on the same page
terraform apply   # type yes
```

> ✅ Success check: in the AWS Console the VPC `local-modules` exists. The apply succeeds with the parameters you passed.
>

---

### Step 4 — Notice the smell: two args, one concept

`vpc_cidr` and `vpc_name` are **two top-level arguments that both describe VPC configuration**. That's a good signal to **group them into one object**. Do that next.

---

### Step 5 — Replace the two primitives with a `vpc_config` object

In the module's `variables.tf`, **remove** `vpc_cidr` and `vpc_name` and add a single object variable. Move the validation onto the object's `cidr_block`.

**`modules/networking/variables.tf`**

```hcl
variable "vpc_config" {
  type = object({
    cidr_block = string
    name       = string
  })

  validation {
    condition     = can(cidrnetmask(var.vpc_config.cidr_block))
    error_message = "The cidr_block config option must contain a valid CIDR block."
  }
}
```

**What this does:**

- `type = object({...})` — one structured input with typed attributes (`cidr_block`, `name`).
- The validation now reads `var.vpc_config.cidr_block`.
- The two old primitive variables are gone.

---

### Step 6 — Update the VPC resource to use the object

Because the variables changed, the resource references break. Point them at the object's attributes.

**`modules/networking/vpc.tf`**

```hcl
resource "aws_vpc" "this" {
  cidr_block = var.vpc_config.cidr_block

  tags = {
    Name = var.vpc_config.name
  }
}
```

> ℹ️ Note the attribute is `name` (inside the object), not `vpc_name`.
>

---

### Step 7 — Update the root call to pass an object

The module's **interface** changed, so the caller must change too.

**`networking.tf`**

```hcl
module "networking" {
  source = "./modules/networking"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "local-modules"
  }
}
```

> ⚠️ **Breaking change:** changing a module's input shape changes its **interface**. For a **published** module this requires a **major version** bump — clients must migrate to the new interface when they adopt the new major version. Grouping into objects also makes it easier to **add** attributes later without breaking the whole interface.
>

---

### Step 8 — Plan, format, and tidy up

```bash
terraform plan
```

**Expected: no changes.** All you did was change the module's **interface** — the resulting infrastructure is identical.

Then format the nested files:

```bash
terraform fmt -recursive
```

Tidy up the module:

- `vpc.tf` and `variables.tf` are working.
- `main.tf` is now empty — you can **delete it** (the VPC lives in `vpc.tf`).

> ✅ Success check: `terraform plan` reports **no changes**; the module exposes a single `vpc_config` object input with validation on `cidr_block`.
>

---

## Congratulations on Completing the Exercise!

You implemented the VPC inside your local module, deployed it, then refactored two primitive inputs into a single **`vpc_config` object** — moving the validation along with it. You saw why changing a module's interface is a **breaking change** for published modules and adopted the habit of **grouping related inputs under objects** instead of scattering primitives at the top level.

> 🧹 Remember to `terraform destroy` when you're done experimenting so you don't leave the VPC running.
