## Introduction

This lab wraps up the **local modules** journey from **Lab 1.9** by actually *consuming* the module's outputs. In the **root** module you'll deploy an **EC2 instance** into one of the networking module's **private subnets**, referencing it by output. You'll also add a small improvement to the module: an `access` tag on each subnet (`public`/`private`).

The goal is to understand:

- **Composing modules with resources** — feed a module output (`subnet_id`) into a root-level resource.
- **Referencing keyed outputs** — `module.networking.private_subnets["subnet_1"].subnet_id`.
- **Conditional tags** — set a tag value based on each subnet's `public` flag.

> 💡 This is the payoff of all the output work: the EC2 instance lands in a specific subnet just by referencing the module's output map by key.
>

## Desired Outcome

By the end you will have:

1. A root `compute.tf` with an Ubuntu AMI data source and one `aws_instance`.
2. The instance placed in a **private** subnet via `module.networking.private_subnets["subnet_1"].subnet_id`.
3. A `project_name` local used to name the instance.
4. An `access` tag (`public`/`private`) added to every subnet in the module, set conditionally.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.
>

## Prerequisites

- Completed **Lab 1.9** (the finished, packaged module).
- Terraform `~> 1.7` and AWS credentials configured.

---

## Step-by-Step Guide

### Step 1 — Add the AMI data source and instance type local

Create `compute.tf` in the **root**. Reuse the Ubuntu AMI data source from the earlier compute lab and add a `project_name` local.

**`compute.tf`**

```hcl
locals {
  project_name = "local-modules"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-*-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
```

---

### Step 2 — Create the EC2 instance in a private subnet

Add an `aws_instance` (single instance — no `count`). Wire its `subnet_id` to the module's **private** subnet output.

**`compute.tf`**

```hcl
resource "aws_instance" "this" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t2.micro" # or t3.micro, whichever is free-tier in your region

  subnet_id = module.networking.private_subnets["subnet_1"].subnet_id

  tags = {
    Name = local.project_name
  }
}
```

**What this does:**

- `ami = data.aws_ami.ubuntu.id` — the looked-up Ubuntu image.
- `subnet_id = module.networking.private_subnets["subnet_1"].subnet_id` — references the module's output map by the **user's key** (`subnet_1`), pulling the real subnet ID.

> ⚠️ **Common typo:** the attribute is `subnet_id`, not `id`. Check the module's `outputs.tf` — each entry is `{ subnet_id, az }`. So it's `...private_subnets["subnet_1"].subnet_id`.
>

---

### Step 3 — Plan and apply

```bash
terraform plan
terraform apply
```

This is a slightly long-running op (instance launch). Confirm with `yes`.

> ✅ Success check (Console → EC2): a running instance named `local-modules` exists, attached to the `subnet_1` private subnet.
>

---

### Step 4 — Improvement: add an `access` tag to subnets

A useful tag was missing from the module: mark each subnet `public` or `private`. Set it conditionally from the subnet's `public` flag.

**`modules/networking/vpc.tf`** — in the `aws_subnet` resource's `tags`:

```hcl
  tags = {
    Name   = "${var.vpc_config.name}-${each.key}"
    access = each.value.public ? "public" : "private"
  }
```

**What this does:**

- `each.value.public ? "public" : "private"` — public subnets get `access = "public"`, the rest `access = "private"`.
- Handy later for **fetching subnets by tag** (e.g. a data source filtering on `access`).

Re-apply:

```bash
terraform apply
```

With four subnets this changes **four** resources (tags added). Confirm in the Console (VPC → Subnets → a subnet → Tags) that `access` is applied correctly per subnet.

> ℹ️ Example with the 4-subnet config: subnet_1 private, subnet_2 public, subnet_3 public, subnet_4 private.
>

---

### Step 5 — Destroy (important!)

The VPC, subnets, IGW, and route tables are free — but the **EC2 instance** incurs usage. Destroy everything to stay in the free tier.

```bash
terraform destroy
```

> 🧹 Confirm all resources (≈10) are gone, including the instance.
>

---

## Congratulations on Completing the Exercise!

You consumed your own module from the **root**: launched an EC2 instance into a **private subnet** by referencing the module's keyed output (`private_subnets["subnet_1"].subnet_id`), and added a conditional `access` tag to the module's subnets. This closes the local-modules journey — you've authored, validated, documented, and **composed** a real networking module. Next you'll publish it and migrate to the remote version.
