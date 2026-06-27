## Introduction

You've covered the core of Terraform Cloud — **workspaces** and the many ways they customize runs, access control, and more. This final lab is **cleanup**: tear down everything you created across the section so Terraform Cloud (and your AWS account) is left on a **clean slate** with nothing billing or lingering.

This lab covers:

- **Queuing a destroy plan** from a workspace's settings to remove its resources from the UI.
- **Deleting workspaces** once they hold no resources.
- **Unpublishing a private registry module** (a single version, or all versions/providers).

> 💡 No code in this lab — it's all done in the Terraform Cloud UI. Do it whenever you're done experimenting so you don't leave anything behind.
> 

## Desired Outcome

By the end you will have:

1. **Destroyed all resources** in the VCS workspace via a **queued destroy plan** (the three remaining resources).
2. **Deleted both workspaces** (`terraform-cli` and `terraform-vcs`) — each only after confirming it has no resources.
3. **Unpublished the private module** from the registry.
4. A **clean** Terraform Cloud organization with no workspaces, no module, and no leftover AWS resources.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Completed the section's labs ([12.1](../12.1%20-%20Creating%20a%20Workspace%20in%20Terraform%20Cloud/lab.md)–[12.10](../12.10%20-%20Publishing%20and%20Consuming%20a%20Private%20Registry%20Module/lab.md)).
- Owner/admin access to the workspaces and the private registry module.

---

## Step-by-Step Guide

### Step 1 — Queue a destroy plan for the VCS workspace

Open the workspace that still has resources (the `terraform-vcs` one) → **Settings → Destruction and Deletion**.

- Under **Destroy infrastructure**, click to **Queue destroy plan**.
- You'll be asked to confirm by typing the **workspace name** — copy/paste it, then **Queue destroy plan**.

Wait for the plan to generate.

> ℹ️ A destroy plan is the UI equivalent of `terraform destroy` — it plans to remove everything the workspace manages.
> 

---

### Step 2 — Confirm and apply the destroy

When the destroy plan is ready, review it.

> ✅ Success check: it lists the **three resources** to remove (VPC, subnet, S3 bucket). **Confirm & Apply**, confirm the plan, and wait for the destruction to finish.
> 

---

### Step 3 — Delete the workspaces

From the home page you have **two** workspaces. Delete each one after verifying it holds **no resources**:

1. **CLI workspace** (`terraform-cli`) — confirm it has no resources, then **Settings → Destruction and Deletion → Delete from Terraform Cloud**, type `delete`, and delete.
2. **VCS workspace** (`terraform-vcs`) — same: confirm no resources, **Settings → Destruction and Deletion → Delete from Terraform Cloud**, type `delete`, delete.

> ✅ Success check: no workspaces remain.
> 

---

### Step 4 — Unpublish the private module

Go to the **Registry**. Your networking module is still there, marked **private**.

- Open it → **Manage module for organization → Delete module**.
- Choose to delete a **single version** or **all providers and versions** — pick to delete the whole module.
- Type `delete` and press **Delete**.

> ✅ Success check: the private module is gone. The registry is empty.
> 

---

## Congratulations on Completing the Exercise!

You cleaned up Terraform Cloud end to end: queued a **destroy plan** to remove the workspace's resources, **deleted both workspaces** once empty, and **unpublished** the private registry module. Your Terraform Cloud organization is back to a clean slate, and all the AWS resources created through these labs are gone — nothing left behind, nothing billing.

> 🧹 Don't forget the loose ends outside Terraform Cloud: delete the temporary **IAM access key** you created in [12.4](../12.4%20-%20Authenticating%20to%20AWS%20with%20Environment%20Variables%20and%20Creating%20an%20S3%20Bucket/lab.md), and remove the throwaway GitHub repo if you no longer need it.
> 
