## Introduction

This lab takes the local networking module from **Lab 1.10** and **publishes it to the Terraform Registry**, then **consumes the remote version** from a fresh root configuration. You'll also improve the module by adding **variable descriptions** (which the registry renders as docs) and learn the **tagging / SemVer** workflow that drives registry releases.

The goal is to understand:

- **Registry naming convention** — `terraform-<provider>-<name>` repo names.
- **Module publishing flow** — public GitHub repo → git **tag** (SemVer) → connect to the registry.
- **SemVer for modules** — `0.1.0` for pre-1.0, patch bump (`0.1.1`) for non-breaking doc/format changes.
- **Consuming a remote module** — `source = "<namespace>/<name>/<provider>"` + `version`.
- **Variable descriptions** — surfaced as input docs on the registry (incl. heredoc multi-line).

> ⚠️ The publishing steps touch an **external service** (GitHub + Terraform Registry) under **your** account. They are described here as instructions — run them yourself with your own GitHub identity. Nothing is auto-published for you.
>

## Desired Outcome

By the end you will have:

1. A separate public GitHub repo named `terraform-aws-networking-tf-course` containing the module files.
2. A `v0.1.0` git tag (the first release), then `v0.1.1` after adding descriptions.
3. The module **published** on the Terraform Registry.
4. Variable **descriptions** on `vpc_config` and `subnet_config` (heredoc).
5. A new root folder consuming the **remote** module by `source` + `version`, with two subnets (one public, one private).

> Try the publishing flow yourself. The solution files here cover the **consuming** root and the **described** variables.
>

## Prerequisites

- Completed **Lab 1.10** (the finished module).
- A GitHub account and a Terraform Registry login (sign in with GitHub).
- `git`, Terraform `~> 1.7`, AWS credentials.

---

## Part A — Publish the Module

### Step 1 — Create the module repository

Create a **new public GitHub repo** following the registry convention: `terraform-<PROVIDER>-<NAME>`.

- Name: `terraform-aws-networking-tf-course`
- Description: *"The networking module created during Laura Mueller's Terraform course."* — the registry **uses this description**, so include one.
- Visibility: **Public** (required for the public registry).
- Add a **README**, a **`.gitignore`** (Terraform template), and an **MIT license**.

> ℹ️ Naming matters: the registry parses `terraform-aws-networking-tf-course` into provider `aws` and module name `networking-tf-course`.
>

---

### Step 2 — Clone into a SEPARATE folder and copy the module files

Clone the new repo into a folder **outside** your existing Terraform project (that project is itself a git repo — don't nest repos).

```bash
git clone git@github.com:<you>/terraform-aws-networking-tf-course.git
cd terraform-aws-networking-tf-course
```

Copy the **contents** of `modules/networking/` from Lab 1.10 (the `examples/`, `outputs.tf`, `providers/versions`, `variables.tf`, `vpc.tf`, `LICENSE`) into the **root** of this new repo. The module is the repo root for publishing — not a subfolder.

Paste the module's README content into the repo `README.md` (drop the redundant title). Set the LICENSE copyright to your name.

---

### Step 3 — Commit and push

```bash
git add .
git commit -m "feat: networking-tf-course add files"
git push
```

Refresh GitHub — the code is there, but there are **no releases/tags** yet. The registry publishes **tags**, so you need one.

---

### Step 4 — Tag the first release (SemVer) and push tags

Create the tag on the command line:

```bash
git tag v0.1.0
git push --tags
```

**Why `0.1.0`?** It signals a module still **under development**. You normally don't cut a `1.0.0` (major) until real users have tested and given feedback. First release of a brand-new module → `0.1.0`.

Refresh GitHub — the `v0.1.0` tag now appears.

---

### Step 5 — Publish on the Terraform Registry

1. Go to the Terraform Registry → **Sign in** with **GitHub** (grant permissions so Terraform can read repos and set webhooks).
2. **Publish → Module**. The registry lists only repos that follow the `terraform-<provider>-<name>` convention.
3. Select the repo → **I agree to the terms** → **Publish module**.

You get the familiar module page: source link, examples, inputs, outputs.

> ℹ️ Your `examples/complete` shows up as a **submodule** (it's a subfolder). Inputs/outputs are generated from `variables.tf` / `outputs.tf`. Variables with no `default` are marked **required**.
>

---

## Part B — Improve and Re-release

### Step 6 — Add variable descriptions

The registry showed inputs with **no descriptions**. Add them.

**`variables.tf`** (in the module repo)

```hcl
variable "vpc_config" {
  description = "The VPC configuration, more specifically the required CIDR block and the VPC name."
  type = object({
    cidr_block = string
    name       = string
  })
  # ... validation ...
}

variable "subnet_config" {
  description = <<-EOT
  Accepts a map of subnet configurations. Each subnet configuration should contain:
    - cidr_block: the CIDR block of the subnet.
    - public:     whether the subnet should be public or not. Defaults to false.
    - az:         the availability zone where to deploy this subnet.
  EOT
  type = map(object({
    cidr_block = string
    az         = string
    public     = optional(bool, false)
  }))
  # ... validation ...
}
```

**Notes:**

- Heredoc (`<<-EOT ... EOT`) gives a readable multi-line description — though the registry doesn't always preserve the formatting nicely.
- Trade-off with object variables: rich grouping is great for **usability**, but a single object with many attributes is **hard to document** in one description. Balance the two; split very large objects.

Format (including the example):

```bash
terraform fmt -recursive
```

---

### Step 7 — Commit, tag a patch, push

This is a non-breaking docs/format change → bump the **patch** version only.

```bash
git add .
git commit -m "refactor: networking-tf-course add variable description and adjust formatting"
git tag v0.1.1
git push --tags
```

Refresh the registry — it now shows **two versions**, and the inputs carry descriptions.

> 💡 In real projects, automate tag-based publishing in **CI/CD** instead of doing it by hand. Connecting the repo to the registry + a pipeline that pushes tags keeps published versions in sync automatically.
>

---

## Part C — Consume the Remote Module

### Step 8 — Create a consuming root configuration

Back in your main Terraform project, create a new folder `use-module` (this lab's folder). Add the module call from the registry's **Provision Instructions**, plus a provider.

**`networking.tf`**

```hcl
module "networking" {
  source  = "<your-namespace>/networking-tf-course/aws"
  version = "0.1.1"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "remote-module"
  }

  subnet_config = {
    subnet_1 = {
      cidr_block = "10.0.0.0/24"
      az         = "eu-west-1a"
    }
    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-west-1b"
      public     = true
    }
  }
}
```

> ℹ️ Replace `<your-namespace>` with your registry namespace (your GitHub username/org). The `source` is **not** a local path now — it's the registry address `namespace/name/provider`.
>

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

---

### Step 9 — Init and plan

```bash
cd "use-module"
terraform init   # downloads the module FROM THE REGISTRY (not a local path)
terraform plan   # source your AWS creds first
```

**Expected:** init pulls the remote module; `plan` shows the VPC + two subnets (and IGW/route table/association for the public one).

> ✅ Success check: `terraform init` reports downloading `…/networking-tf-course/aws 0.1.1`, and `plan` succeeds. Nothing is applied here — there's nothing to destroy.
>

---

## Congratulations on Completing the Exercise!

You published your module to the **Terraform Registry** via the `terraform-aws-…` repo convention and **SemVer git tags**, improved it with **variable descriptions** (patch release `0.1.1`), and then **consumed the remote module** by `source` + `version` from a fresh root configuration. You saw the documentation trade-offs of object variables and why **CI/CD** should own tag-based publishing in real projects. Next you'll migrate existing code from the local module to this remote one.

> 🧹 This lab only planned (no apply), so there's nothing to destroy.
