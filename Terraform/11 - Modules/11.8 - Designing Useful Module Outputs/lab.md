## Introduction

This lab continues the **local networking module** from **Lab 1.7**. The resources are done, but the module exposes almost nothing useful — the temporary `public_subnets` output just reflects the input config back, with no resource IDs. A consumer can't link other resources to what the module built.

Here you design **proper outputs**: the VPC ID, and **separate** `public_subnets` / `private_subnets` maps that each carry the real `subnet_id` and `az`, keyed by the user's own subnet keys.

The goal is to understand:

- **Why outputs matter** — they're the module's public surface; without IDs, the module isn't composable.
- **Transforming data for outputs** — `for` expressions that map config keys to real resource attributes.
- **Output-only locals** — derive shaped data once, keep it near related logic.
- **Map-keyed outputs** — preserve the caller's keys so they can stably reference a specific subnet.
- **Curating outputs** — expose enough, but not everything (cognitive load).

> 💡 Best practice: expose as much **useful** information as the use case needs — but **curate** it. Reflecting every resource attribute raises the user's cognitive load and makes the module harder to use.
>

## Desired Outcome

By the end you will have:

1. A `vpc_id` output (with a description).
2. A `public_subnets` output: a map of `{ subnet_id, az }` keyed by subnet key — built from the real `aws_subnet` resource, not the input.
3. A `private_subnets` output of the same shape.
4. Output-only locals (`output_public_subnets`, `output_private_subnets`, and a `private_subnets` filter) in the module.
5. Root outputs (`module_vpc_id`, `module_public_subnets`, `module_private_subnets`) to visualize them.
6. A config with two public + two private subnets, verified via `terraform apply` outputs.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.
>

## Prerequisites

- Completed **Lab 1.7** (module with public subnets, IGW, route table, associations).
- Terraform `~> 1.7` and AWS credentials configured.

---

## Step-by-Step Guide

### Step 1 — See the problem: outputs just reflect inputs

The current module output reflects the input config (no IDs):

```hcl
output "public_subnets" {
  value = local.public_subnets   # just the input config back
}
```

`terraform output` shows the subnet config you passed in — but no `subnet_id`, so nothing external can link to a specific subnet. We'll fix that.

> ℹ️ Sketch the outputs you want as comments first: `vpc_id`, an object of `public_subnets`, an object of `private_subnets`.
>

---

### Step 2 — Output the VPC ID

The VPC ID is the most essential output — root resources will reference it.

**`modules/networking/outputs.tf`**

```hcl
output "vpc_id" {
  value       = aws_vpc.this.id
  description = "The AWS ID from the created VPC."
}
```

**What this does:**

- Returns the real VPC ID. (Many VPC attributes exist; expose what the use case needs — here, just the ID.)
- Always add a `description` — it makes the output easier to consume.

---

### Step 3 — Build a shaped local for public-subnet outputs

Don't output the raw input. Transform it: map each public-subnet **key** to an object carrying the real `subnet_id` and `az` from the `aws_subnet` resource.

**`modules/networking/vpc.tf`** (add to locals)

```hcl
locals {
  # (existing) the public-subnet filter used by the resources
  public_subnets = {
    for key, config in var.subnet_config : key => config if config.public
  }

  # output-only: shape public subnets into { subnet_id, az }
  output_public_subnets = {
    for key in keys(local.public_subnets) : key => {
      subnet_id = aws_subnet.this[key].id
      az        = aws_subnet.this[key].availability_zone
    }
  }
}
```

**What this does:**

- `for key in keys(local.public_subnets)` — iterate the public subnet keys.
- For each, emit `{ subnet_id, az }` pulled from the real resource `aws_subnet.this[key]`.
- Name it `output_public_subnets` (distinct from `public_subnets`) — locals merge across files, so the identifier must be unique. The `output_` prefix signals intent.

---

### Step 4 — Output `public_subnets` (the shaped version)

**`modules/networking/outputs.tf`**

```hcl
output "public_subnets" {
  value       = local.output_public_subnets
  description = "The ID and availability zone of public subnets."
}
```

**Why a map keyed by the user's key?**

- The caller chose the keys (e.g. `subnet_2`), so they can reference `module.networking.public_subnets["subnet_2"].subnet_id` directly.
- A **list** would be fragile — no guarantee the output order matches the input order, so a subnet can't be stably identified. Maps + reflected keys make lookups stable.

---

### Step 5 — Add a private-subnets filter local

Mirror the public filter for private subnets (`public == false`, which includes any subnet that omitted `public`).

**`modules/networking/vpc.tf`** (add to locals)

```hcl
  private_subnets = {
    for key, config in var.subnet_config : key => config if config.public == false
  }

  output_private_subnets = {
    for key in keys(local.private_subnets) : key => {
      subnet_id = aws_subnet.this[key].id
      az        = aws_subnet.this[key].availability_zone
    }
  }
```

> ℹ️ `public` is `optional(bool, false)`, so subnets without `public` default to `false` and land here. Keeping the filter and shaping locals together (in `vpc.tf`) keeps the similar logic in one place.
>

---

### Step 6 — Output `private_subnets`

**`modules/networking/outputs.tf`**

```hcl
output "private_subnets" {
  value       = local.output_private_subnets
  description = "The ID and availability zone of private subnets."
}
```

---

### Step 7 — Surface the outputs at the root

Module outputs don't print on their own — re-expose them at the root to visualize.

**`outputs.tf`** (root)

```hcl
output "module_vpc_id" {
  value = module.networking.vpc_id
}

output "module_public_subnets" {
  value = module.networking.public_subnets
}

output "module_private_subnets" {
  value = module.networking.private_subnets
}
```

```bash
terraform fmt -recursive
terraform plan
```

The plan shows the changed outputs — public subnets now carry `subnet_id` + `az` (not the raw config), plus a new `module_vpc_id`.

---

### Step 8 — Extend the config and apply

Add more subnets to exercise both maps — two public, two private.

**`networking.tf`**

```hcl
  subnet_config = {
    subnet_1 = { cidr_block = "10.0.0.0/24", az = "eu-west-1a" }
    subnet_2 = { cidr_block = "10.0.1.0/24", az = "eu-west-1b", public = true }
    subnet_3 = { cidr_block = "10.0.2.0/24", az = "eu-west-1c", public = true }
    subnet_4 = { cidr_block = "10.0.3.0/24", az = "eu-west-1a" }
  }
```

```bash
terraform fmt -recursive
terraform apply
```

**What happens:** new subnets `subnet_3` (public) + `subnet_4` (private) are added, plus a **route-table association** for the new public subnet `subnet_3`. The outputs now show two entries under `module_private_subnets` and two under `module_public_subnets`.

> ✅ Success check: `terraform output` shows `module_vpc_id`, `module_public_subnets` (subnet_2, subnet_3 with `subnet_id` + `az`), and `module_private_subnets` (subnet_1, subnet_4).
>

---

### Step 9 — Curate, don't dump

You *could* expose more subnet attributes (ARN, etc.). Check the `aws_subnet` resource's exported attributes and decide per use case:

- **Public module** (unknown audience) → expose more.
- **Private/internal module** (known users) → expose a tighter, curated set.

Either way, don't reflect everything — over-exposure raises cognitive load for users who may not know networking well.

---

## Congratulations on Completing the Exercise!

You replaced reflective outputs with **useful, shaped** ones: a `vpc_id`, and `public_subnets` / `private_subnets` maps carrying real `subnet_id` + `az`, keyed by the caller's own keys for stable lookups. You used **output-only locals** and `for` transformations, and learned to **curate** outputs to the use case. The module is now genuinely composable.

> 🧹 You deployed real resources — run `terraform destroy` when finished so you don't leave a VPC, subnets, IGW, and route tables running.
