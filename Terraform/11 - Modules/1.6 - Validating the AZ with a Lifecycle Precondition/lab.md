## Introduction

This lab continues the **local networking module** from **Lab 1.5**. The subnets work, but nothing checks that the `az` a user passes actually exists in the configured region. You'll add that validation — the **right** way.

A plain `validation` block can't do it: validating the AZ needs **data from outside** (the region's real AZ list). So you'll use a **`data` source** plus a **`lifecycle` precondition** on the subnet resource, and craft a **user-friendly, multi-line error message**.

The goal is to understand:

- **Why `validation` blocks aren't enough** — they can't reference data sources or other resources.
- **`lifecycle { precondition { ... } }`** — validate using composed/external data, blocking `apply` before it hits the AWS API.
- **`aws_availability_zones` data source** — look up the real AZs for the region.
- **Composing great error messages** — `each.key`, `each.value.az`, the region, and the valid-AZ list, joined into readable text.

> 💡 Teaching point: a precondition catches a bad AZ at **plan** time with a clear message — instead of letting the **AWS API** reject it mid-`apply` with a cryptic `InvalidParameter`.
>

## Desired Outcome

By the end you will have:

1. An `aws_availability_zones` data source (`available`) in the module.
2. A `lifecycle` **precondition** on `aws_subnet` that asserts each subnet's `az` is in the region's real AZ list.
3. A multi-line error message showing the subnet key, the region, the invalid AZ, and the list of supported AZs (via `join`).
4. A clean `terraform plan` when AZs are valid; a clear **precondition** error when they aren't.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.
>

## Prerequisites

- Completed **Lab 1.5** (the module with `subnet_config` + `for_each` subnets).
- Terraform `~> 1.7` and AWS credentials configured.

---

## Step-by-Step Guide

### Step 1 — See the problem: a bad AZ passes `plan` but fails `apply`

Temporarily set a subnet's `az` to one **outside** your region, e.g. `eu-central-1b` while the provider region is `eu-west-1`.

**`networking.tf`**

```hcl
    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-central-1b"
    }
```

Run:

```bash
terraform plan    # passes — Terraform can't tell it's invalid
terraform apply   # FAILS at the AWS API with an InvalidParameter error
```

`eu-central-1b` isn't in `eu-west-1`, so the **AWS API** rejects it — but only after you started applying. We want to catch this earlier with a clearer message.

---

### Step 2 — Add the availability-zones data source

In the module's `vpc.tf` (or a data file), look up the region's real AZs.

**`modules/networking/vpc.tf`** (add)

```hcl
data "aws_availability_zones" "available" {
  state = "available"
}
```

**What this does:**

- Returns the AZs that are **available** in the provider's region (e.g. `eu-west-1a/b/c`).
- The list of names is `data.aws_availability_zones.available.names`. We'll check the user's `az` against it.

---

### Step 3 — Add a lifecycle precondition on the subnet

Why not a `validation` block? Validation blocks are **restricted** — they can't reference data sources or compose external values. A **`precondition`** inside `lifecycle` can. Add one to `aws_subnet`.

**`modules/networking/vpc.tf`**

```hcl
resource "aws_subnet" "this" {
  for_each = var.subnet_config

  vpc_id            = aws_vpc.this.id
  availability_zone = each.value.az
  cidr_block        = each.value.cidr_block

  tags = {
    Name = "${var.vpc_config.name}-${each.key}"
  }

  lifecycle {
    precondition {
      condition     = contains(data.aws_availability_zones.available.names, each.value.az)
      error_message = "Invalid AZ"
    }
  }
}
```

**What this does:**

- `contains(<region AZ names>, each.value.az)` — true only if the user's AZ is a real AZ in the region.
- If false, the precondition fails at **plan** time with the `error_message`.
- It can reference **both** the data source and `each.value` — exactly what a `validation` block cannot do.

Run `terraform plan` with a valid AZ → passes. Switch a subnet to `eu-central-1b` → **`Error: Resource precondition failed`**. The bad AZ is caught before any apply.

---

### Step 4 — Make the error message user-friendly

`"Invalid AZ"` works but tells the user nothing. Compose a clear, multi-line message from everything you can access:

- `each.key` — the subnet's map key (e.g. `subnet_2`).
- `each.value.az` — the invalid AZ the user provided.
- `data.aws_availability_zones.available.id` — the region (the data source's `id` is the region name).
- `data.aws_availability_zones.available.names` — the list of supported AZs.

**`modules/networking/vpc.tf`**

```hcl
  lifecycle {
    precondition {
      condition = contains(data.aws_availability_zones.available.names, each.value.az)
      error_message = <<-EOT
      The AZ ${each.value.az} provided for the subnet ${each.key} is invalid.
      The applied AWS region ${data.aws_availability_zones.available.id} supports the following AZs: ${join(", ", data.aws_availability_zones.available.names)}.
      EOT
    }
  }
```

**What this does:**

- `<<-EOT ... EOT` — a multi-line (heredoc) string for a readable message.
- `join(", ", data.aws_availability_zones.available.names)` — the names attribute is a **list**; `join` turns it into a comma-separated string. (Signature: `join(separator, list)` — separator first.)

> ℹ️ The `join` function "produces a string by concatenating all the elements of the specified list of strings with the specified separator." Without it, embedding the raw list in the string errors.
>

Example output when invalid:

```
The AZ eu-central-1b provided for the subnet subnet_2 is invalid.
The applied AWS region eu-west-1 supports the following AZs: eu-west-1a, eu-west-1b, eu-west-1c.
```

> 💡 Always invest in user-friendly error messages. As a **module author**, the user's experience when something goes wrong is your responsibility — make failures clear and intuitive.
>

---

### Step 5 — Confirm it passes with a valid AZ

Set the subnet back to a region-valid AZ and re-plan:

**`networking.tf`**

```hcl
    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-west-1b"
    }
```

```bash
terraform fmt -recursive
terraform plan
```

**Expected:** plan exits with **no errors** — valid AZs satisfy the precondition.

> ✅ Success check: a bad AZ produces the multi-line precondition error at plan time; valid AZs plan cleanly.
>

---

### Step 6 — Update the README progress

Mark the second requirement **done** — the module now validates the AZ.

```markdown
- [x] Create a VPC with a given CIDR block.
- [x] Allow the user to provide the configuration for multiple subnets.
  - [x] Provide CIDR blocks.
  - [x] Provide the AWS availability zone (validated against the region).
  - [ ] Mark a subnet as public or private.
```

---

## Congratulations on Completing the Exercise!

You validated the availability zone using an `aws_availability_zones` **data source** and a **`lifecycle` precondition** — something a plain `validation` block can't do, because it needs external/composed data. You also built a **user-friendly multi-line error message** with `join`, surfacing the subnet key, region, invalid AZ, and supported AZs. Preconditions/postconditions are a powerful pattern for thorough input validation. Next you'll add public/private subnet behavior.

> 🧹 If you `apply` to try it live, run `terraform destroy` afterward so you don't leave a VPC and subnets running.
