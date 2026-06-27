## Introduction

This lab wraps up the **local networking module** from **Lab 1.8**. The code is done — now you add the things that make a module **shareable and usable**: a **LICENSE**, a real **README**, and an **`examples/`** folder.

The goal is to understand the non-code parts of a quality module:

- **LICENSE** — declares how others may (re)use your module, with real legal implications.
- **README** — describes what the module does and shows **example usage**.
- **`examples/`** — runnable usage patterns users can copy and learn from.

> 💡 No infrastructure changes here — this lab is pure module **packaging**. The wider the audience, the more documentation matters.
>

## Desired Outcome

By the end you will have:

1. A populated `LICENSE` (MIT) in the module.
2. A `README.md` with a description and an **Example Usage** Terraform code block.
3. An `examples/complete/main.tf` showing a realistic call, with a comment explaining the unique `public = true` option.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.
>

## Prerequisites

- Completed **Lab 1.8** (the finished module with useful outputs).
- Terraform `~> 1.7`.

---

## Step-by-Step Guide

### Step 1 — Choose and add a LICENSE

Pick a license deliberately — it controls how others may reuse your module:

- **Permissive** (MIT, Apache-2.0) — reuse freely, including commercially, with attribution.
- **Copyleft** (GPL) — derivatives that reuse your code must also be open-sourced. That has real implications for anyone building a commercial product on top of it.
- **Closed/proprietary** — restrict reuse entirely.

This module uses **MIT** (permissive — there's nothing special to protect here, just examples).

**`modules/networking/LICENSE`**

```text
MIT License

Copyright (c) 2024 Laura Mueller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> ℹ️ Set the copyright year and holder to your own. Evaluate which license fits **your** users and how you want to protect the module.
>

---

### Step 2 — Write the README with example usage

Describe what the module does, then show how to call it.

**`modules/networking/README.md`**

````markdown
# Networking Module

This module manages the creation of VPCs and subnets, allowing for the creation
of both private and public subnets.

## Example Usage

```hcl
module "networking" {
  source = "./modules/networking"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "your-vpc"
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
````

**What this does:**

- The description is short and concrete — what the module creates.
- The **Example Usage** block (fenced as `hcl`) is copied from a real call, trimmed to a lean example.

> 💡 For a wider audience, add more: tables of **inputs** and **outputs** (like the public registry modules show). Here, a description + one example is enough.
>

---

### Step 3 — Create an `examples/complete` folder

Provide a runnable example so users see practical usage. Convention: `examples/<name>/`, e.g. `examples/complete/`.

```
modules/networking/
└── examples/
    └── complete/
        └── main.tf
```

**`modules/networking/examples/complete/main.tf`**

```hcl
module "networking" {
  source = "../../"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "your-vpc"
  }

  subnet_config = {
    subnet_1 = {
      cidr_block = "10.0.0.0/24"
      az         = "eu-west-1a"
    }

    # Public subnets are indicated by setting the `public` option to true.
    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-west-1b"
      public     = true
    }
  }
}
```

**What this does / why the comment:**

- Copies the example call into a runnable `main.tf`. `source = "../../"` points back up to the module root from `examples/complete/`.
- The `cidr_block`, `az`, and `vpc_config` values are passed straight through. The **unique** thing about this module is the `public` key — it triggers several decisions behind the scenes (IGW, route table, associations). The comment makes that discoverable.

> ℹ️ If a module has lots of functionality, add multiple example folders (`complete`, `minimal`, etc.) covering common usage patterns.
>

---

### Step 4 — Recap: what makes a quality module

Beyond working code, a good module ships:

- **LICENSE** — choose one appropriate to your users and how you want to protect the module.
- **README** — a description (more detail the wider the scope/audience) plus example usage, ideally input/output tables.
- **`examples/`** — runnable, practical usage patterns so users can explore real configurations.

> ✅ Success check: the module folder contains a populated `LICENSE`, a `README.md` with an Example Usage block, and `examples/complete/main.tf` with the `public` comment.
>

---

## Congratulations on Completing the Exercise!

You finished packaging the module: chose and added an **MIT LICENSE** (understanding the implications of license choice), wrote a **README** with example usage, and added an **`examples/complete/`** folder demonstrating the module — including the unique `public` flag. These non-code pieces are what turn working Terraform into a module others can confidently reuse. Next you'll publish it.
