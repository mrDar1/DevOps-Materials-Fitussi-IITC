## Introduction

In the previous lab ([12.2 - Connecting the CLI with terraform login and the Cloud Block](../12.2%20-%20Connecting%20the%20CLI%20with%20terraform%20login%20and%20the%20Cloud%20Block/lab.md)) you linked your project to a Terraform Cloud workspace and ran a remote `apply` that produced **no changes**. Now you'll create your **first actual resource** through Terraform Cloud and confirm the run from the **UI**.

This lab covers three ideas:

- **Creating a resource via Terraform Cloud** — a `random_id` resource plus an output, applied remotely.
- **CLI run, but gated** — a CLI-triggered `apply` is **planned** and then **waits for confirmation**; it doesn't apply automatically.
- **The UI-driven confirmation** — you can approve a planned run from the **Terraform Cloud UI** (with a comment) instead of typing `yes` in the terminal. Approving in the UI counts as a **UI-driven workflow** interaction.

> 💡 Building on 12.2: same project, same workspace. We just add a resource so there's finally something for Terraform Cloud to create — and we approve it from the web UI to see that path.
> 

## Desired Outcome

By the end you will have:

1. A **`random.tf`** file defining a `random_id` resource (`byte_length = 4`) and a `random_id` output of its `.hex` value.
2. A CLI-triggered `terraform apply` that becomes a **planned** run **waiting for confirmation** in Terraform Cloud.
3. The run **confirmed from the UI** (with a comment), which applies it.
4. The workspace **Overview** showing **1 resource** and **1 output** after the apply.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Completed [12.2](../12.2%20-%20Connecting%20the%20CLI%20with%20terraform%20login%20and%20the%20Cloud%20Block/lab.md): authenticated CLI (`terraform login`) and a `provider.tf` with the `cloud` block + `random` provider, already `init`-ed.
- Access to your Terraform Cloud workspace in the browser to confirm the run from the UI.

---

## Step-by-Step Guide

### Step 1 — Review the previous run in Terraform Cloud

Open your workspace in Terraform Cloud and look at the run from lab 12.2.

- The previous run is marked **completed**.
- Click into it: because no resources were defined, it lists **no resources** and **no outputs**.

> ℹ️ This confirms the integration works end-to-end before we add anything to create.
> 

---

### Step 2 — Define a random ID resource and output

Create a new file **`random.tf`** with a `random_id` resource and an output exposing its hex value:

```hcl
resource "random_id" "this" {
  byte_length = 4
}

output "random_id" {
  value = random_id.this.hex
}
```

**What this does:**

| Element | Meaning |
| --- | --- |
| `resource "random_id" "this"` | Creates a random identifier — no cloud credentials needed, so it's perfect for a first remote run. |
| `byte_length = 4` | Generates 4 random bytes (an 8-character hex string). |
| `output "random_id"` | Surfaces the generated value so it shows in the run output and the workspace. |
| `random_id.this.hex` | The generated id encoded as a **hexadecimal** string. |

Save the file.

---

### Step 3 — Trigger a remote apply

From the project folder, run:

```bash
terraform apply
```

**What you'll observe:**

- The output looks **just like a local `terraform apply`** — it's the same Terraform, simply running on another machine.
- The plan shows it will **add 1 resource** (`random_id`) and **change 1 output**, with the value **known after apply**.

> ℹ️ Back in the Terraform Cloud UI, a run appears that was **triggered via the CLI**. Its status is **planned** and it is **waiting for confirmation** — because you haven't approved it yet, it stays in `planned`.
> 

---

### Step 4 — Confirm the run from the UI

Instead of typing `yes` in the terminal, approve the run from the **Terraform Cloud web UI**.

- Open the planned run in the workspace. It shows it will **add a new `random_id` resource** and **change one output** (known after apply), with the **apply pending**.
- Click **Confirm & Apply**.
- Add a comment, e.g. *"Looks good to me."*
- **Confirm the plan.**

> ℹ️ Approving from the UI is itself a **UI-driven workflow** interaction. You could equally approve from the CLI by typing `yes` — both work.
> 

> ✅ Success check: back in the terminal, the `Enter a value:` prompt resolves with a note that the run was **approved using the UI or the API**, and the resource is **successfully added**.
> 

---

### Step 5 — Verify the resource and output

Return to the workspace **Overview** in Terraform Cloud.

> ✅ Success check: the workspace now lists **1 resource** (the `random_id`) and **1 output** (`random_id`). Everything is working as expected.
> 

---

## Congratulations on Completing the Exercise!

You created your first resource through Terraform Cloud — a `random_id` with an output — triggered the run from the CLI, and approved it from the **UI** with a comment. You saw that a CLI-driven run is **planned and waits for confirmation**, and that approval can come from either the CLI or the UI. The resource and output now show in the workspace.

> 🧹 The `random_id` is a free, in-state-only resource (nothing billable). If you want to reset the workspace, run `terraform destroy` and confirm.
> 
