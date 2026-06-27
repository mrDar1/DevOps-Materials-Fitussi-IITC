## Introduction

In this lab you will use the **public AWS VPC module** from the Terraform Registry to provision a complete VPC with public and private subnets — without writing every low-level resource (VPC, subnets, route tables, gateways) by hand.

The goal is to understand three ideas:

- **What a module is** — a reusable, versioned package of Terraform resources you call with inputs instead of copy-pasting code.
- **How to call a public module** — using `source` + `version` from the registry.
- **How to feed dynamic data into a module** — using a **data source** to look up Availability Zones at plan time instead of hardcoding them.

> 💡 A module is just Terraform code in a folder. The `terraform-aws-modules/vpc/aws` module is maintained by the community and creates dozens of resources (VPC, subnets, route tables, IGW, NAT, etc.) from a handful of inputs.
> 

## Desired Outcome

By the end you will have deployed:

1. A VPC named `public-modules` with CIDR block `10.0.0.0/16`.
2. A **data source** that fetches the available Availability Zones in your region.
3. One **private** subnet — `10.0.0.0/24`.
4. One **public** subnet — `10.0.128.0/24`.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Terraform `~> 1.7` installed (`terraform version` to check).
- AWS credentials configured (`aws configure` or environment variables).
- Permission to create VPC resources in your account.

---

## Step-by-Step Guide

### Step 1 — Create the project folder and provider config

Create a new folder named `public-modules`. Inside it create a file (e.g. `main.tf`) with the Terraform settings and AWS provider.

```hcl
terraform {
  required_version = "~> 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "eu-west-1"
}
```

**What this does:**

- `required_version = "~> 1.7"` — pins the Terraform CLI to the `1.7.x` line so the lab behaves consistently.
- `required_providers` — declares the AWS provider and constrains it to major version 5 (`~> 5.0`). The VPC module we use requires AWS provider v5.
- `provider "aws"` — sets the region. Use the region you have been working in; the lab uses `eu-west-1`.

> ℹ️ `~>` is the **pessimistic constraint**. `~> 5.0` allows `5.x` but not `6.0`.
> 

---

### Step 2 — Fetch the Availability Zones with a data source

Add a data source to query AWS for the AZs that are currently available in the region.

```hcl
data "aws_availability_zones" "azs" {
  state = "available"
}
```

**What this does:**

- A **data source** reads existing information from AWS — it does **not** create anything.
- `aws_availability_zones` returns the AZs for the provider's region (e.g. `eu-west-1a`, `eu-west-1b`, `eu-west-1c`).
- `state = "available"` filters out AZs that are impaired or unavailable.
- We reference the result later as `data.aws_availability_zones.azs.names`.

> 💡 Why a data source instead of hardcoding `["eu-west-1a", "eu-west-1b"]`? Because AZ names differ per region and can change. Looking them up keeps the config portable across regions.
> 

---

### Step 3 — Call the public VPC module

Now call the registry VPC module and pass your configuration as inputs. Pin it to version `5.5.3` for compatibility with this lab.

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.3"

  cidr            = "10.0.0.0/16"
  name            = "public-modules"
  azs             = data.aws_availability_zones.azs.names
  private_subnets = ["10.0.0.0/24"]
  public_subnets  = ["10.0.128.0/24"]
}
```

**What each argument means:**

| Argument | Value | Meaning |
| --- | --- | --- |
| `source` | `terraform-aws-modules/vpc/aws` | Path to the module on the Terraform Registry. |
| `version` | `5.5.3` | Pins the module version so results are reproducible. |
| `cidr` | `10.0.0.0/16` | The overall address range of the VPC (65,536 IPs). |
| `name` | `public-modules` | Name tag applied to the VPC and related resources. |
| `azs` | `data.aws_availability_zones.azs.names` | The list of AZs from the data source in Step 2. |
| `private_subnets` | `["10.0.0.0/24"]` | One private subnet (no direct internet route). |
| `public_subnets` | `["10.0.128.0/24"]` | One public subnet (routed to an Internet Gateway). |

> ℹ️ The module spreads subnets across the AZs in the `azs` list, in order. With one CIDR per type, each lands in the first AZ.
> 

> 💡 The difference between public and private here is **routing**: the module attaches an Internet Gateway and points the public subnet's route table at it; the private subnet has no such route.
> 

---

### Step 4 — Initialize, plan, and apply

Run the standard Terraform workflow from inside the `public-modules` folder:

```bash
terraform init
terraform plan
terraform apply
```

**What each command does:**

- `terraform init` — downloads the AWS provider **and the VPC module** into `.terraform/`. You must run this first (and again whenever you change `source`/`version`).
- `terraform plan` — shows what will be created. Confirm you see a VPC, two subnets, route tables, and an Internet Gateway.
- `terraform apply` — creates the resources. Type `yes` to confirm.

> ✅ Success check: in the AWS Console (VPC service) you should see a VPC named `public-modules` with one public and one private subnet.
> 

---

### Step 5 — Clean up (important!)

These resources are free-tier-friendly but **always destroy lab resources when done** to avoid surprises.

```bash
terraform destroy
```

Type `yes` to confirm. Verify in the Console that the VPC is gone.