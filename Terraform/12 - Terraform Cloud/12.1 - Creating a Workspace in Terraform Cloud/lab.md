## Introduction

In this lab you will take your first practical steps with **Terraform Cloud** — HashiCorp's hosted service for managing and automating infrastructure as code. You will create an account, set up an **organization**, and create your first **workspace** using the **CLI-Driven Workflow**.

This lab focuses on three ideas:

- **What Terraform Cloud is** — a hosted platform (`app.terraform.io`) for running Terraform safely, sharing state, and collaborating, instead of running everything from your local machine.
- **Organizations and workspaces** — the top-level container (organization) and the unit that holds a single piece of infrastructure's state, runs, and variables (workspace).
- **Where runs actually execute** — a CLI-driven workspace *triggers* runs from your terminal, but those runs execute on **remote Terraform Cloud agents**, not on your local machine.

> 💡 A workspace is roughly the cloud equivalent of a single Terraform working directory: it stores the state, the run history, and the variables for one configuration.
> 

> ⚠️ This lab is **UI-only** — there is no Terraform code to write yet. You set up the workspace here and leave it "waiting for configuration." Wiring the CLI to it comes in the next lab.
> 

## Desired Outcome

By the end you will have:

1. A **Terraform Cloud account**, logged in (GitHub recommended for easier VCS integration later).
2. An **organization** created in Terraform Cloud.
3. A **workspace** named `terraform-cli`, created with the **CLI-Driven Workflow** under the default project.
4. The workspace **overview** page showing that Terraform Cloud is **waiting for configuration**.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- A web browser.
- A **GitHub account** (recommended) — makes signing in and later VCS integration easier. An email-based account also works.
- No local Terraform or AWS credentials needed for this lab; everything happens in the Terraform Cloud UI.

---

## Step-by-Step Guide

### Step 1 — Create an account and log in

Go to **`app.terraform.io`** in your browser. This is the Terraform Cloud (HashiCorp Cloud Platform) sign-in page.

- If you **do not** have an account, click **Create your free account** at the bottom and follow the prompts.
- If you **already** have an account, click **Sign in**.

When prompted, **continue with GitHub**.

**What this does:**

- `app.terraform.io` is the entry point to the Terraform Cloud platform.
- Signing in with GitHub links your GitHub identity, which makes the **Version Control (VCS) integration** smoother in later labs (no separate credential setup).

> 💡 GitHub is recommended, not required — you can sign up with an email and password instead. But VCS-driven workflows are easier when your Git provider is already connected.
> 

---

### Step 2 — Create an organization

The first time you log in, Terraform Cloud asks you to create an **organization**. (If you already have one, click **Create New Organization** from the menu.)

- Provide an **organization name**.
- Provide an **email address**.
- Click **Create Organization**.

**What this does:**

- An **organization** is the top-level container in Terraform Cloud. It owns your projects, workspaces, teams, and billing.
- Inside a new organization you'll see a **default project** already created.

> ℹ️ The **default project cannot be deleted** — if you try, Terraform Cloud blocks it because every organization needs at least the default project. Just leave it as it is.
> 

---

### Step 3 — Start creating a workspace

From the dashboard, click **Create Workspace**.

You will be prompted to choose **how you want to manage this workspace** — one of three workflows:

| Workflow | When you use it |
| --- | --- |
| **Version Control Workflow** | Runs are triggered automatically from commits/PRs in a connected VCS repo. |
| **CLI-Driven Workflow** | Runs are triggered from your terminal with the Terraform CLI (`terraform plan` / `apply`). |
| **API-Driven Workflow** | Runs are triggered programmatically through the Terraform Cloud API. |

Select **CLI-Driven Workflow** — in this course we interact with the workspace via the Terraform CLI.

---

### Step 4 — Name and create the workspace

On the next screen, provide the information that identifies the workspace:

- **Workspace name:** `terraform-cli` — so it's clear this workspace is driven via the Terraform CLI.
- **Project:** leave it under the **default project**.
- **Description (optional):** you can add something like *"For demonstrating interactions via the Terraform CLI."* This field is optional and can be left blank.

Click **Create** at the bottom.

**What this does:**

- Creates the workspace and switches the left-hand menu to the workspace view: **Overview**, **Runs**, **States**, **Variables**, and **Settings**.

---

### Step 5 — Confirm the workspace is waiting for configuration

After creation, open the workspace **Overview**.

> ✅ Success check: Terraform Cloud displays a message that it is **waiting for configuration**. Once you provide a configuration and run CLI-driven commands, results (runs, state) will appear here.
> 

> ℹ️ **Where runs execute:** when you trigger a run via the CLI against this workspace, the run does **not** execute in your local Terraform installation. It runs on a **remote agent in Terraform Cloud**, using the Terraform version configured for the workspace. The agent simply **streams its standard output back to your terminal**, which makes it *look* local.
> 

> ⚠️ Because the run is remote, anything your local machine relies on at run time — for example **environment variables** set in your local shell — is **not** automatically available to the remote agent. You'd need to set those in the workspace's **Variables** instead. Keep this in mind for later labs.
> 

---

## Congratulations on Completing the Exercise!

Great job! You created a Terraform Cloud account, set up an organization, and created a CLI-driven workspace that's now waiting for configuration. You also learned the key mental model that CLI-triggered runs actually execute on **remote Terraform Cloud agents**, not on your local machine. In the next lab you'll connect the Terraform CLI to this workspace and trigger your first remote run.

> 🧹 No billable cloud resources were created in this lab — only a Terraform Cloud workspace, which is free. Nothing to clean up.
> 
