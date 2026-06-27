## Introduction

In this lab you continue the implementation from **Lab 1.1**, where you leverage public modules from AWS to deploy a VPC. Here you refactor that VPC code to use `locals` and shared data, then deploy an **EC2 instance** into the VPC using the public `terraform-aws-modules/ec2-instance/aws` module.

The goal is to understand four ideas:

- **Refactoring with `locals`** — pull hardcoded values (CIDR, subnets, name) out of resource blocks into named locals so they live in one central place instead of being duplicated.
- **Sharing values across files** — a `project_name` and `common_tags` local, kept in a shared file because they are not bound to networking and will be reused by other resources.
- **Looking up an AMI dynamically** — a `data` block that always finds the latest Ubuntu 22.04 image instead of a stale hardcoded AMI ID.
- **Wiring modules together (module composition)** — fetching outputs of the VPC module (default security group, public subnet) and passing them as inputs into the EC2 module.

> 💡 This lab builds on **Lab 1.1** — it reuses and refactors that VPC code. Work in the same project folder.
>

## Desired Outcome

By the end you will have:

1. Refactored the VPC module's values (`vpc_cidr`, `private_subnet_cidrs`, `public_subnet_cidrs`) into a `locals` block in `networking.tf`.
2. A shared file (`shared_data.tf`) holding `project_name` and `common_tags`, referenced by the VPC module.
3. A `data` block that fetches the most recent **Ubuntu 22.04** AMI.
4. An EC2 instance created via the EC2 module (`5.6.1`), placed in the VPC's **public subnet** using the VPC's **default security group**, tagged with the common tags.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.
>

## Prerequisites

- Completed **Lab 1.1** (the VPC module code).
- Terraform `~> 1.7` and AWS credentials configured (source your `.env` / `aws configure`).

---

## Step-by-Step Guide

### Step 1 — Refactor the VPC CIDR into a `locals` block

In `networking.tf`, add a `locals` block. Move the hardcoded `cidr` value into a local called `vpc_cidr`, then reference it from the module.

**`networking.tf`**

```hcl
locals {
  vpc_cidr = "10.0.0.0/16"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.3"

  cidr = local.vpc_cidr
  # ...
}
```

**What this does:**

- A `locals` block defines named values computed once and reused via `local.<name>`. It creates no resources.
- Changing the value now happens in one place instead of being buried in the module call.

---

### Step 2 — Extract the name into a shared file

The name is not specific to networking, so put it in its own file. Create `shared_data.tf` (call it `shared_locals.tf` if you prefer) and add a `project_name` local. Reference it from the VPC module's `name`.

**`shared_data.tf`**

```hcl
locals {
  project_name = "public-modules"
}
```

**`networking.tf`** (reference it)

```hcl
module "vpc" {
  # ...
  name = local.project_name
}
```

**What this does:**

- `project_name` lives in a shared file because other resources (the EC2 instance, future resources) will reuse it — it is not bound to networking.
- Whenever you change `project_name`, the VPC name updates automatically. No hardcoding.
- Splitting into files is purely organizational — Terraform loads **all** `.tf` files in the folder together.

---

### Step 3 — Add `common_tags` and pass them to the VPC

Add shared/common tags to the shared file following the convention adopted so far. Reference them from the VPC module's `tags`.

**`shared_data.tf`**

```hcl
locals {
  project_name = "public-modules"
  common_tags = {
    Project   = local.project_name
    ManagedBy = "Terraform"
  }
}
```

**`networking.tf`**

```hcl
module "vpc" {
  # ...
  tags = local.common_tags
}
```

**What this does:**

- `common_tags` is a **map** applied to resources for ownership, cost tracking, and automation.
- A local can reference another local in the same block (`local.project_name` inside `common_tags`).

> 💡 If you wanted VPC-specific tags **in addition** to the common ones, use `merge()`:
> `tags = merge(local.common_tags, { Custom = "value" })`. For this demo, just `local.common_tags` is enough.
>

---

### Step 4 — Extract the subnet CIDRs into locals

Move the private and public subnet CIDR lists into the `locals` block in `networking.tf` and reference them.

**`networking.tf`**

```hcl
locals {
  vpc_cidr             = "10.0.0.0/16"
  private_subnet_cidrs = ["10.0.0.0/24"]
  public_subnet_cidrs  = ["10.0.128.0/24"]
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.3"

  cidr            = local.vpc_cidr
  name            = local.project_name
  azs             = data.aws_availability_zones.azs.names
  private_subnets = local.private_subnet_cidrs
  public_subnets  = local.public_subnet_cidrs

  tags = local.common_tags
}
```

**What this does:**

- All you did was move the values into locals and reference them — the config behaves the same.
- In this small case locals add little value, but the mindset matters: don't hardcode or duplicate values; keep a central place to manage them. In real configs these locals get referenced in multiple places.

> ℹ️ This is a pure refactor — `terraform fmt` then `terraform plan` should show **no changes** (the tags addition is the only diff if you applied 1.1 without tags).
>

---

### Step 5 — Explore the EC2 module on the Registry and GitHub

Before writing any code, get familiar with the module the same way you would for any third-party module. This habit matters more than the specific module.

**On the Terraform Registry:**

1. Open the [Terraform Registry](https://registry.terraform.io/), use **Browse all / search** at the top and type **"EC2 module"**. Pick **terraform-aws-modules/ec2-instance/aws**.
2. The **usage snippet on the right** shows the `source` and the latest `version` — copy that pattern. We pin **`5.6.1`** for this lab (at recording time it was the latest). If you hit problems on a newer version, get it working on `5.6.1` first, then diff to the newer one. As long as it stays on major **5**, things here should remain compatible.
3. Read the **README** — like the VPC module, it explains how to start: passing `instance_type`, enabling `monitoring`, providing `vpc_security_group_ids` and `subnet_id`, and even creating multiple instances with `for_each`.
   - ⚠️ `for_each` (and `count`) are **Terraform** meta-arguments, **not** part of the module. They work with almost any module — your own modules included — to create multiple instances (multiple VPCs, multiple EC2s, etc.).
4. Open the **Inputs** tab — every input is listed here, and you can see which ones are **required**.
5. Notice there is **no submodules dropdown** for this module — the EC2 module has **no submodules**. Compare with the VPC module, which **does** have a submodules dropdown. Whether a module has submodules depends on the module.

**On GitHub:**

1. From the Registry, click through to the **GitHub repository** and expand it.
2. Look at the **`examples/`** folder — e.g. the **complete** example is comprehensive and shows how to customize the module extensively. Great reference when you need an option you haven't used.
3. Confirm there is **no `modules/` folder** in this repo (that's the submodules folder) — matching what the Registry showed.

> 💡 The EC2 module wraps a lot of compute-related components behind a simple (if extensive) interface. Knowing where the **README**, **Inputs**, **Outputs**, and **examples** live means you can self-serve any module, not just this one.
>

---

### Step 6 — Start the EC2 module in `compute.tf`

Create a new file `compute.tf` and call the EC2 module. The source mirrors the VPC structure: `terraform-aws-modules/vpc/aws` → `terraform-aws-modules/ec2-instance/aws`. Pin version `5.6.1`. We deploy **one** instance, so no `count`/`for_each` needed.

```hcl
module "ec2" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "5.6.1"

  name = local.project_name
  # ...
}
```

---

### Step 7 — Look up the latest Ubuntu 22.04 AMI

Add an `aws_ami` data source at the top of `compute.tf` (the same one used in the earlier compute/data-sources lab — copy it over) and reference it for the `ami`.

```hcl
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

Reference it in the module: `ami = data.aws_ami.ubuntu.id`.

**What this does:**

- `most_recent = true` picks the newest matching image so patches are included.
- `owners = ["099720109477"]` is Canonical's official account — avoids look-alike images.
- AMI IDs differ per region and go stale; the data source keeps the config portable.

---

### Step 8 — Set the instance type (free-tier safe)

Check the module's `instance_type` input: it defaults to **`t3.micro`**. In some regions the free-tier type is **`t2.micro`**, not `t3.micro` — so set it explicitly. Add an `instance_type` local at the top of `compute.tf`.

```hcl
locals {
  instance_type = "t2.micro"
}
```

Reference it: `instance_type = local.instance_type`.

> ⚠️ Always set the instance type explicitly. Don't rely on the module default — it may not be free-tier in your region.
>

---

### Step 9 — Wire in the VPC module's outputs (security group + subnet)

Pass the VPC's **default security group** and **public subnet** into the EC2 module using the `module.<name>.<output>` syntax.

**Finding the right output (the exploration part):**

- You need the SG the VPC module created by default. Search the module's source under `.terraform/modules/vpc/` for `default_security_group` — you'll find the resource `aws_default_security_group.this[0]`. But you don't reference the resource directly; you go through the module's **output**.
- Open the **VPC module** on the Registry → **Outputs** tab → search **"security group"**. There's a `default_security_group_id` output that returns that SG's ID. That's what you pass.
- For the subnet, the relevant output is `public_subnets` (a list). On the Registry Outputs tab it's described as *"List of IDs of public subnets"* — and if you **hover** the attribute in your IDE you'll see the **same description**. Those output descriptions don't show on the CLI but are excellent inline documentation.

```hcl
module "ec2" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "5.6.1"

  name                   = local.project_name
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = local.instance_type
  vpc_security_group_ids = [module.vpc.default_security_group_id]
  subnet_id              = module.vpc.public_subnets[0]

  tags = local.common_tags
}
```

**Key idea — module composition:**

- `module` is a Terraform keyword. You reference a module's outputs just like any other resource: `module.vpc.<output>`.
- `module.vpc.default_security_group_id` — the SG created by default on VPC creation (find it under the VPC module's **Outputs** tab, search "security group"). `vpc_security_group_ids` is a **list**, so you can pass more than one.
- `module.vpc.public_subnets[0]` — a **list** of public subnet IDs; `[0]` takes the first. `subnet_id` is optional but worth setting explicitly.
- Passing one module's outputs into another is how you build infrastructure from reusable pieces. Terraform figures out the dependency order automatically (VPC first, then EC2).

> 💡 The VPC module's outputs carry **descriptions** (e.g. "List of IDs of public subnets"). They don't show on the CLI but are great documentation. Always document the infrastructure you create — it pays off in maintenance.
>

---

### Step 10 — Init, plan, apply

`terraform fmt` first, then:

```bash
terraform init
terraform plan
terraform apply
```

- `terraform plan` will first **error** asking you to run init — because you added a **new module** (`ec2-instance`). Adding a module is like adding a provider: re-run init so it gets downloaded.
- After init, `plan` shows **one more resource** added beyond the VPC. Grep for `aws_instance` to find it — it's `module.ec2.aws_instance.this`, the EC2 instance the module creates.
- Source your `.env` to authenticate, then `apply` and type `yes`. Creation takes a little under a minute.

> ✅ Success check (Console, correct region): one running `t2.micro` instance named `public-modules`, in the VPC you created, placed in the public subnet, tagged `Project` and `ManagedBy`.
>

**What you'll see in the Console:**

- The instance has a VPC ID and a subnet ID. The subnet name concatenates the VPC name and the AZ.
- The VPC's resource map shows **three** route tables: private, public, and default — different from the region's default VPC.
- Subnet↔route-table associations are **explicit**: private subnet → private route table, public subnet → public route table. This is more stable than the implicit default-route-table association.

---

### Step 11 — Clean up (important!)

Destroy everything so you don't pay for a running instance.

```bash
terraform destroy
```

Type `yes` and wait for destruction to complete.

> ℹ️ After destroy you may see a note that the **default network ACL** was **removed from state** but not deleted — Terraform simply stops tracking it. Verify in the Console that the instance is **terminated** and the VPC is gone.
>

---

## Congratulations on Completing the Exercise!

You refactored the VPC config with `locals` and shared data, added common tags, looked up an AMI dynamically, and deployed an EC2 instance wired to your VPC module's outputs. You deployed **multiple modules** together and saw how to **fetch information from one module and feed it into another** — the core idea of **module composition**.
