## Introduction

You've now run several CLI-driven operations against your Terraform Cloud workspace. This lab is a **guided tour** of the workspace features that surround those runs: the **state history** Terraform Cloud keeps for every run, and the **workspace settings** (version, auto-apply, destroy plans, run tasks, run triggers, and more).

This lab covers:

- **State history** — Terraform Cloud stores a versioned state for **every** run, so you can inspect any past state and the diff between consecutive states.
- **Reading state diffs** — what was added/removed between states, the **check results** from variable validations, and why resource ordering in state is irrelevant.
- **Workspace settings** — Terraform version, auto-apply, locking, UI-driven destroy plans, run tasks, and run triggers (workspace-to-workspace).

> 💡 This is a **UI-only exploration** lab — no Terraform code to write. It builds on the runs you already created in [12.5](../12.5%20-%20Using%20Terraform%20Variables%20and%20Deploying%20an%20EC2%20Instance/lab.md) and earlier; you just browse them.
> 

## Desired Outcome

By the end you will have explored:

1. The **States** tab — the history of state versions, one per CLI run (oldest = just the `random_id`; later ones add the S3 bucket, the EC2 instance; the last = everything removed).
2. The **state diff** view — added/removed resources, and the **check result** from the `t2.micro` validation.
3. The workspace **Settings** — Terraform version, auto-apply, locking, version control, and the **destroy plan** option.
4. **Run tasks** and **run triggers** — where you add custom logic around plan/apply and chain workspaces together.

> Try clicking through it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Completed labs [12.1](../12.1%20-%20Creating%20a%20Workspace%20in%20Terraform%20Cloud/lab.md)–[12.5](../12.5%20-%20Using%20Terraform%20Variables%20and%20Deploying%20an%20EC2%20Instance/lab.md), so the workspace has a **run history** to inspect.
- Browser access to your Terraform Cloud workspace.

---

## Step-by-Step Guide

### Step 1 — Open the state history

In your workspace, click **States** in the left-hand menu.

You'll see a list of state versions — **one per run** you triggered from the CLI. Each entry is timestamped (the oldest might be a couple of days old, depending on when you ran the earlier labs).

> ℹ️ Terraform Cloud keeps a **full history** of your state, so you can inspect any older state — not just the current one.
> 

---

### Step 2 — Inspect individual states

Click into states from oldest to newest and notice how the contents grow and shrink:

- **Oldest state** — contains **only the `random_id`** (the first resource you created in 12.3).
- **Next state** — now also includes the **S3 bucket** (added in 12.4).
- **The EC2 state** — adds the **`aws_instance`**.
- **Last state** — **empty**: everything was removed by the `terraform destroy` in 12.5.

> 💡 Each state is a snapshot of what existed *after* that run. Reading them in order tells the story of your infrastructure.
> 

---

### Step 3 — Read the diff between states

Scroll down within a state to see the **changes** between the previous state and the one you're inspecting — what was **added** and what was **removed**.

- In the **last** (destroy) state, everything is **crossed out** — you deleted it all.
- In the **EC2** state, scroll down to find a **check result**: this is the `t2.micro` **variable validation** (`var.ec2_instance_type == "t2.micro"`) reported in the state.

> ℹ️ You'll notice resources appear in a different **order** than in your `.tf` files — e.g. the AMI **data source** (with its filters) sits where you might expect the S3 bucket, and the S3 bucket shows up later at index `2`. Terraform moves things around in state internally.
> 

> 💡 **Don't worry about state ordering or layout.** The state is designed for **Terraform**, not for humans — you should never hand-edit it or depend on how it's stored.
> 

---

### Step 4 — Explore the workspace settings

From the workspace home, click **Settings**.

Hover over each option to read its description. Key settings:

| Setting | What it does |
| --- | --- |
| **Terraform Version** | Pin which Terraform version the remote agent uses (match what your projects use). |
| **Auto-apply** | Automatically apply successful plans, so you don't have to confirm runs manually. |
| **Lock workspace** | Prevent any runs until unlocked. |
| **Version Control** | Settings shown if you connect a VCS repo to the workspace. |

---

### Step 5 — Destroy plans from the UI

Still in **Settings**, find the **Destruction and Deletion** area.

- Enable **Allow destroy plans**, then you can **Queue destroy plan** from the UI.
- This is the UI equivalent of running `terraform plan -destroy` and then applying that destroy plan — a way to tear down **all** the workspace's resources without the CLI.

> ℹ️ This mirrors the CLI `terraform destroy` flow you used in 12.5, just initiated from the web UI.
> 

---

### Step 6 — Run tasks and run triggers

Browse the remaining settings sections:

- **Run Tasks** — add **custom logic** at hook points around a run: **before/after plan** and **before/after apply**. Lets you customize workspace run behavior (e.g. external policy or scanning checks).
- **Run Triggers** — connect this workspace to **other workspaces**. If a large project is split across workspaces, you can have a successful run in an **upstream** workspace **automatically trigger** a run in this one.

> 💡 Paid plans unlock more features here, such as **continuous validation (check results)** and **automatic drift detection**. On the free plan, click around to see what's available and consult the documentation.
> 

---

## Congratulations on Completing the Exercise!

You explored how Terraform Cloud keeps a **versioned state history** for every run, learned to read the **diffs and check results** between states (and why state ordering doesn't matter — state is for Terraform, not humans), and toured the workspace **settings**: Terraform version, auto-apply, locking, UI **destroy plans**, **run tasks**, and **run triggers** for chaining workspaces. Keep exploring the UI and the docs to discover more.

> 🧹 No resources are created in this lab — it's read-only exploration. If labs 12.4/12.5 left anything running, make sure those were destroyed.
> 
