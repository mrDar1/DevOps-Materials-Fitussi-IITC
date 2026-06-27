## Introduction

This lab continues the **local networking module** from **Lab 1.6**. So far every subnet is effectively private. Now you implement the headline feature: let users **mark a subnet `public`**, and have the module wire up everything that makes a subnet public — behind a one-line interface.

When at least one subnet is public, the module must:

1. Deploy an **internet gateway** (exactly one, even with many public subnets).
2. Create a **public route table** with a default route (`0.0.0.0/0`) to the IGW.
3. **Associate** each public subnet with that route table.

The goal is to understand:

- **Optional object attributes** — `optional(bool, false)` so `public` defaults to off.
- **Filtering a map with a `for` expression** — derive the public-only subset into a local.
- **Conditional resources with `count`** — create the IGW/route table only when needed, and index them (`[0]`).
- **Cross-referencing count vs for_each resources** — `aws_subnet.this[each.key].id` inside an association.
- **Exposing module outputs** and surfacing them at the root.

> 💡 The user only adds `public = true`. The module hides the IGW, route table, route, and associations. That's the abstraction modules are for.
>

## Desired Outcome

By the end you will have:

1. A `public` attribute on each subnet — `optional(bool, false)`.
2. A `local.public_subnets` filtering the map down to public subnets.
3. A module **output** `public_subnets` surfaced at the root as `module_public_subnets`.
4. An `aws_internet_gateway` created **only** when ≥1 public subnet exists.
5. An `aws_route_table` (public) with a `0.0.0.0/0` route to the IGW, created conditionally.
6. An `aws_route_table_association` per public subnet, linking it to the public route table.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.
>

## Prerequisites

- Completed **Lab 1.6** (module with subnets + AZ precondition).
- Terraform `~> 1.7` and AWS credentials configured.

---

## Step-by-Step Guide

This is requirement **2.3**, broken into sub-steps:

- **2.3.1** — let users mark a subnet public; if ≥1 is public, deploy an internet gateway.
- **2.3.2** — create the public route table + route to the IGW.
- **2.3.3** — associate each public subnet with the public route table.

---

### Step 1 — Add an optional `public` attribute

Add `public` to the subnet object. Make it **optional** with a default of `false`, so existing configs keep working and unmarked subnets stay private.

**`modules/networking/variables.tf`**

```hcl
variable "subnet_config" {
  type = map(object({
    cidr_block = string
    az         = string
    public     = optional(bool, false)
  }))
  # ... existing cidr validation ...
}
```

In the root, marking a subnet public is now one line:

**`networking.tf`**

```hcl
    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-west-1b"
      public     = true
    }
```

> ℹ️ `optional(bool, false)` — if the user omits `public`, it defaults to `false` (private).
>

---

### Step 2 — Filter the public subnets into a local

In the module's `vpc.tf`, build a map containing **only** the public subnets, using a `for` expression with an `if`.

**`modules/networking/vpc.tf`**

```hcl
locals {
  public_subnets = {
    for key, config in var.subnet_config : key => config if config.public
  }
}
```

**What this does:**

- Iterates `var.subnet_config`, re-emitting `key => config` **only when** `config.public` is true.
- Result is a map of just the public subnets — drives the IGW/route-table/association logic below.

---

### Step 3 — Expose it as an output (to inspect it)

To see what the filter produced, output it from the module and surface it at the root.

**`modules/networking/outputs.tf`**

```hcl
output "public_subnets" {
  value = local.public_subnets
}
```

**`outputs.tf`** (root)

```hcl
output "module_public_subnets" {
  value = module.networking.public_subnets
}
```

**Why two outputs?** A module output isn't visible on the CLI by itself — it's consumed by the **caller**. Re-exposing it as a **root** output makes it print. Run `terraform plan` and you'll see only the public subnet(s) (e.g. just `subnet_2`).

---

### Step 4 — Deploy the internet gateway conditionally (2.3.1)

Create the IGW only when there's at least one public subnet, using `count`.

**`modules/networking/vpc.tf`**

```hcl
resource "aws_internet_gateway" "this" {
  count = length(local.public_subnets) > 0 ? 1 : 0

  vpc_id = aws_vpc.this.id
}
```

**What this does:**

- `count = length(local.public_subnets) > 0 ? 1 : 0` — **one** IGW if any public subnet exists, **zero** otherwise.
- Using the `> 0 ? 1 : 0` form (not raw `length`) guarantees **at most one** IGW, even with multiple public subnets.
- `vpc_id` attaches the IGW to the VPC. **Don't forget this** — omitting it causes an apply error (see Step 7).

> ✅ Plan check: with one public subnet, you see **1 internet gateway to add**. Remove `public = true` → empty `module_public_subnets` output and **no IGW**.
>

---

### Step 5 — Create the public route table + route (2.3.2)

Add a route table (conditional, same `count`) with a default route to the IGW.

**`modules/networking/vpc.tf`**

```hcl
resource "aws_route_table" "public_rtb" {
  count = length(local.public_subnets) > 0 ? 1 : 0

  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this[0].id
  }
}
```

**What this does:**

- Same conditional `count` — created only when public subnets exist.
- `route { 0.0.0.0/0 → IGW }` — the default route that makes a subnet "public".
- `aws_internet_gateway.this[0].id` — because the IGW uses `count`, you must **index it** (`[0]`), not reference `.this` directly.

> ⚠️ **count indexing:** any resource created with `count` is accessed as `resource.name[index]`, e.g. `aws_internet_gateway.this[0]`. This applies to the route table and association references too.
>

---

### Step 6 — Associate each public subnet with the route table (2.3.3)

Loop the public subnets and associate each with the public route table.

**`modules/networking/vpc.tf`**

```hcl
resource "aws_route_table_association" "public" {
  for_each = local.public_subnets

  subnet_id      = aws_subnet.this[each.key].id
  route_table_id = aws_route_table.public_rtb[0].id
}
```

**What each part does:**

| Part | Meaning |
| --- | --- |
| `for_each = local.public_subnets` | One association per public subnet. |
| `subnet_id = aws_subnet.this[each.key].id` | The subnets use `for_each`, so index by **key**: `aws_subnet.this[each.key]`. |
| `route_table_id = aws_route_table.public_rtb[0].id` | The route table uses `count`, so index by **`[0]`**. |

> ℹ️ Note the mix: `aws_subnet` is keyed (`[each.key]`) because it's `for_each`; the route table/IGW are indexed (`[0]`) because they're `count`.
>

---

### Step 7 — Format, plan, apply (and the missing-`vpc_id` gotcha)

```bash
terraform fmt -recursive
terraform plan
terraform apply
```

The plan shows the subnet, route table, IGW, and association. On `apply`:

> ⚠️ **Common error:** if you forgot `vpc_id` on the internet gateway, `apply` fails because the IGW and route table "belong to different networks". Add `vpc_id = aws_vpc.this.id` to the IGW and apply again. You'll see the route table **replaced** and the IGW **modified** (1 to add, 1 to change, 1 to destroy on the fix-up apply).

> ✅ Success check (Console): the public subnet's route table has a `0.0.0.0/0` route to the IGW and an **explicit** subnet association. A private subnet shows only an **implicit** association with the main route table.
>

---

### Step 8 — Update the README progress

Mark the public/private requirement done.

```markdown
- [x] Create a VPC with a given CIDR block.
- [x] Allow the user to provide the configuration for multiple subnets.
  - [x] Provide CIDR blocks.
  - [x] Provide the AWS availability zone (validated).
  - [x] Mark a subnet as public or private.
```

---

## Congratulations on Completing the Exercise!

You added an optional `public` flag, **filtered** the map to public subnets with a `for` expression, and conditionally created an **internet gateway**, a **public route table** with a default route, and **route-table associations** — all driven by one `public = true` in the caller's config. You worked with `count`-indexed (`[0]`) and `for_each`-keyed (`[each.key]`) resources side by side. The module now hides real networking complexity behind a tiny interface. Next you'll improve the module's **outputs**.

> 🧹 You deployed real resources here — run `terraform destroy` when finished so you don't leave a VPC, subnets, IGW, and route tables running.
