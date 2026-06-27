# Notes — Using the Public AWS VPC Module

Quick notes on what we did and noticed during this lab.

## Calling a module

- A module is just Terraform code in a folder. We **call** it, we don't write the resources ourselves.
- Block syntax: `module "<name>" { ... }`. The name (`vpc`, `my_vpc`, `prod_vpc`) is arbitrary — it's a local label only.
- The required input is `source`. For the public VPC module: `terraform-aws-modules/vpc/aws`.
- Pin `version` so everyone gets the same results. We used `5.5.3`.

## What `terraform init` does with a module

- Downloads the module source into `.terraform/modules/`.
- It's literally the GitHub source — same files, same `variables.tf`, same structure as the repo.
- Also pulls the AWS provider **required by the module** (module needs AWS `>= 5.20`).
- With no conflicting constraint in our root, init grabbed a recent 5.x provider automatically.

## Provider version conflicts (the gotcha)

- Module declares its own provider constraint in its `versions.tf` (min version it needs).
- Our **root** `required_providers` constraint must also be satisfiable **together** with the module's.
- Constraints are AND'd — **all** must hold, not OR.
- We tested pinning root to `= 5.0.0`. `init` failed: can't be both `>= 5.20` (module) and `= 5.0.0` (root).
  - Error: locked/configured provider version did not match — no release satisfies both.
- Fix: loosen root to `~> 5.0` (allows 5.x, blocks 6.0). Then `init -upgrade` passed.
- Takeaway: if root can't allow the module's min provider version, use an **older module version** with a looser constraint.

## The `azs` error (data source fix)

- First `plan` failed: `var.azs` was an empty list → count.index 0 indexing into `[]`.
- Cryptic error, but root cause = module needs AZs and we passed none.
- Fix with a **data source** (reads existing info, creates nothing):
  ```hcl
  data "aws_availability_zones" "azs" {
    state = "available"
  }
  ```
- Pass it in: `azs = data.aws_availability_zones.azs.names`.
- Why data source not hardcode `["eu-west-1a", ...]`? AZ names differ per region / can change → keeps config portable.

## Provider config we forgot (twice)

- `plan` errored until we added the `provider "aws"` block with `region`.
- Remember to source `.env` / set credentials before plan.

## Subnet design decision

- CIDR `10.0.0.0/16` for the VPC.
- Private subnet `10.0.0.0/24`, public subnet `10.0.128.0/24`.
- The /16 split (low half private, high half public) is **just our choice** — no AWS requirement.

## What the module created under the hood (`plan` showed ~12 resources)

- VPC
- Public subnet + private subnet
- Internet Gateway
- Route tables (public, private, default) + the public route to the IGW
- Route table associations
- Default security group + default network ACL

## Takeaways

- Modules = encapsulation + abstraction. One small input block → dozens of resources.
- Don't need to know all VPC internals to use it — but worth learning them first so you can inspect what's built.
- Always understand a module's **dependencies and version constraints** before using it.
- Run `terraform fmt` as you go to keep files clean.
