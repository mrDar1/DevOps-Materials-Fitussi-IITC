## Introduction

This lab continues the **local networking module** from **Lab 1.4**. The VPC input is done; now you let users configure **subnets**.

You'll add a `subnet_config` input that accepts **multiple** subnets, validate all their CIDR blocks at once, and use `for_each` to create one `aws_subnet` per entry — wiring each to the VPC automatically.

The goal is to understand:

- **`map(object)` inputs** — accept a collection of structured items (multiple subnets) under one variable.
- **Validating a collection** — use `alltrue([... for ...])` to validate every element, not just one.
- **`for_each` over a map** — create one resource per map entry, using `each.key` and `each.value`.
- **Abstraction** — the user supplies only subnet config; the module decides how each subnet links to the VPC.

> 💡 Requirement progress: "create a VPC with a given CIDR" is **done**. This lab tackles "allow the user to configure multiple subnets (CIDR + AZ)". Marking a subnet public/private comes later.
>

## Desired Outcome

By the end you will have:

1. A `subnet_config` variable typed `map(object({ cidr_block = string, az = string }))`.
2. A validation that rejects the config if **any** subnet's `cidr_block` is invalid (via `alltrue`).
3. An `aws_subnet` resource created with `for_each` over `subnet_config` — one subnet per map entry.
4. Each subnet wired to the VPC (`vpc_id`), placed in its `az`, named `<vpc name>-<map key>`.
5. A root call passing two subnets; `terraform plan` shows **2 subnets to add**.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.
>

## Prerequisites

- Completed **Lab 1.4** (the local module with the `vpc_config` object + VPC resource).
- Terraform `~> 1.7` and AWS credentials configured.

---

## Step-by-Step Guide

### Step 1 — Decide the input shape: a map of objects

You want users to create **multiple** subnets. A single `object` would look just like `vpc_config` and allow only one subnet. So use a **`map(object)`** instead: a map whose values are subnet objects.

- The map **key** is just a label the user picks (e.g. `subnet_1`) — not important to the module.
- Each value is an object describing one subnet (CIDR block, AZ).

> ℹ️ Edit the **module's** `variables.tf` (under `modules/networking/`), not the root one.
>

---

### Step 2 — Add the `subnet_config` variable with collection validation

**`modules/networking/variables.tf`** (add)

```hcl
variable "subnet_config" {
  type = map(object({
    cidr_block = string
    az         = string
  }))

  validation {
    condition = alltrue([
      for config in values(var.subnet_config) : can(cidrnetmask(config.cidr_block))
    ])
    error_message = "The cidr_block config option must contain a valid CIDR block."
  }
}
```

**What this does:**

- `map(object({...}))` — accepts any number of named subnet objects.
- The validation must check **every** subnet, not one. So:
  - `values(var.subnet_config)` — the list of subnet objects (keys don't matter here).
  - `for config in ... : can(cidrnetmask(config.cidr_block))` — a list of `true`/`false`, one per subnet.
  - `alltrue([...])` — `true` only if **all** CIDRs are valid.
- `az` is just received for now; meaningful AZ validation needs a bigger setup and comes in a later lab.

---

### Step 3 — Provide subnets from the root module

In the root `networking.tf`, pass a map of subnets. Use underscores in keys (a dash needs quotes).

**`networking.tf`**

```hcl
module "networking" {
  source = "./modules/networking"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "local-modules"
  }

  subnet_config = {
    subnet_1 = {
      cidr_block = "10.0.0.0/24"
      az         = "eu-west-1a"
    }
  }
}
```

Run a plan from the root folder — expect **no errors, no changes** yet (the subnet resource doesn't exist until the next step):

```bash
terraform plan
```

> ⚠️ **Experiment — collection validation:** temporarily set an invalid CIDR (e.g. `cidr_block = "300.0.0.0/24"`) and run `terraform plan`. You get the validation error referencing `var.subnet_config is map of object with 1 element` and **"The cidr_block config option must contain a valid CIDR block."** Restore a valid value afterward.
>

---

### Step 4 — Create the subnet resource with `for_each`

In the module's `vpc.tf`, add an `aws_subnet` that iterates over `subnet_config`.

**`modules/networking/vpc.tf`** (add)

```hcl
resource "aws_subnet" "this" {
  for_each = var.subnet_config

  vpc_id            = aws_vpc.this.id
  availability_zone = each.value.az
  cidr_block        = each.value.cidr_block

  tags = {
    Name = "${var.vpc_config.name}-${each.key}"
  }
}
```

**What each part does:**

| Part | Meaning |
| --- | --- |
| `for_each = var.subnet_config` | Create one subnet per map entry. `each.key` = map key, `each.value` = the subnet object. |
| `vpc_id = aws_vpc.this.id` | Wire the subnet to the VPC created in this module. The user never sets this. |
| `availability_zone = each.value.az` | The AZ from that subnet's object. |
| `cidr_block = each.value.cidr_block` | The CIDR from that subnet's object. |
| `Name = "${var.vpc_config.name}-${each.key}"` | Names the subnet `<vpc name>-<key>`, e.g. `local-modules-subnet_1`. |

---

### Step 5 — Format and plan

```bash
terraform fmt -recursive
terraform plan
```

**Expected:** **1 resource to add** — the subnet. Confirm the plan shows the `Name` (the map key), the `availability_zone`, and the `cidr_block`.

> ✅ Success check: `terraform plan` reports the subnet with name `local-modules-subnet_1`, AZ `eu-west-1a`, CIDR `10.0.0.0/24`.
>

---

### Step 6 — Add a second subnet (the payoff)

Adding another subnet is now trivial for the user — just another map entry. No new resources to wire by hand.

**`networking.tf`**

```hcl
  subnet_config = {
    subnet_1 = {
      cidr_block = "10.0.0.0/24"
      az         = "eu-west-1a"
    }
    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-west-1b"
    }
  }
```

```bash
terraform plan
```

**Expected:** **2 resources to add**. The user supplies only configuration — they never worry about where the subnet lives or how it links to the VPC. That's the (small, for now) layer of abstraction. It grows once public/private routing is added.

---

### Step 7 — Update the README progress

In the module's `README.md`, mark the VPC requirement **done** and the subnet requirement **in progress** — meaningful AZ validation is still to come.

```markdown
- [x] Create a VPC with a given CIDR block.
- [~] Allow the user to provide the configuration for multiple subnets.
  - [x] Provide CIDR blocks.
  - [x] Provide the AWS availability zone.
  - [ ] Mark a subnet as public or private.
  - [ ] Validate that the AZ is a valid AZ.
```

---

## Congratulations on Completing the Exercise!

You added a `map(object)` input so users can declare **multiple subnets**, validated **all** their CIDR blocks with `alltrue`, and used `for_each` to create one `aws_subnet` per entry — each automatically wired to the VPC and named from its map key. The module now hides subnet-to-VPC wiring behind a simple config interface. Next you'll validate the availability zone and add public/private behavior.

> 🧹 If you `apply` to try it live, run `terraform destroy` afterward so you don't leave a VPC and subnets running.
