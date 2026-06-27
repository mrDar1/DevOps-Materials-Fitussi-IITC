## Introduction

So far ([12.3 - Creating a Random ID and Confirming the Run from the UI](../12.3%20-%20Creating%20a%20Random%20ID%20and%20Confirming%20the%20Run%20from%20the%20UI/lab.md)) the only resource you created — a `random_id` — needed **no cloud credentials**. Real infrastructure needs to authenticate to AWS. But remote Terraform Cloud agents **don't have your local environment variables**, so you must give the credentials to Terraform Cloud itself.

This lab covers:

- **Why local env vars don't work** — runs execute on Terraform Cloud agents, which can't see `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` set on your machine.
- **Workspace environment variables** — store the AWS credentials in the workspace as **environment variables** (marked **sensitive**), and the remote agent can authenticate to AWS.
- **Proving it works** — create a real **S3 bucket** through Terraform Cloud, then **break it on purpose** by deleting the key to see the exact credential error, then restore it.

> ⚠️ Storing long-lived IAM **access keys** in Terraform Cloud is a **quick hack, not the recommended approach**. An automation platform should **assume a role** via **OIDC short-lived credentials** instead. That's covered in a separate, self-contained project later. Use static keys only for short experiments — and delete them soon after.
> 

## Desired Outcome

By the end you will have:

1. A new IAM **access key** for your admin user, added to the Terraform Cloud workspace as two **sensitive environment variables**: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
2. The **AWS provider** declared (`hashicorp/aws`, `5.0`) and configured with a region.
3. An **S3 bucket** (`aws_s3_bucket`) named using the `random_id`, created through Terraform Cloud and confirmed in the AWS Console.
4. (Optional experiment) Observed the exact **`No valid credential sources found`** error after deleting the key variable, then restored it.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Completed [12.3](../12.3%20-%20Creating%20a%20Random%20ID%20and%20Confirming%20the%20Run%20from%20the%20UI/lab.md): linked workspace with the `random_id` resource.
- An AWS account with an admin IAM user (the lab uses `udemy-admin`) and permission to create access keys + S3 buckets.
- Browser access to both the AWS Console and your Terraform Cloud workspace.

---

## Step-by-Step Guide

### Step 1 — Create an AWS access key for Terraform Cloud

In the AWS Console, open **IAM → Users → your admin user → Security credentials**.

- Scroll to **Access keys** and click **Create access key**.
- Choose **Command Line Interface (CLI)**, check **I understand the above recommendation**, click **Next**.
- Description: `Terraform Cloud`. Click **Create access key**.
- Keep the **Access key ID** and **Secret access key** values — you'll paste them into Terraform Cloud.

> ℹ️ AWS allows a **maximum of two access keys** per user. If you already have two, delete one you don't need first. (Keep the one your **local** setup uses.)
> 

> 💡 Logging in *as a user* from an automation platform isn't ideal — an automation tool should **assume a role**, not act as a person. This is exactly why the later OIDC project exists.
> 

---

### Step 2 — Add the credentials as workspace environment variables

In Terraform Cloud, open your workspace → **Variables**.

Workspace variables hold information used by runs, and can be either **Terraform variables** or **environment variables**. AWS credentials are read from the environment, so add them as **environment variables**:

- Click **Add variable** → choose **Environment variable**.
- Key: `AWS_ACCESS_KEY_ID`, Value: the access key ID. **Mark as sensitive.** Add variable.
- Click **Add variable** again → **Environment variable**.
- Key: `AWS_SECRET_ACCESS_KEY`, Value: the secret access key. **Mark as sensitive.** Add variable.

> ℹ️ **Sensitive** variables are write-only: their value is **never shown** again and **cannot be edited** (only deleted and recreated). That's why you keep the original values handy.
> 

> 💡 If you needed the same credentials across **multiple workspaces**, you could use a **Variable Set** (reusable across the org). It's not recommended here — one credential set used everywhere is a security smell — so add them to **this workspace only**.
> 

---

### Step 3 — Add and configure the AWS provider

In **`provider.tf`**, add the AWS provider to `required_providers` and configure a region:

```hcl
terraform {
  # ... cloud block and random provider unchanged ...
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.0"
    }
  }
}

provider "aws" {
  region = "eu-west-1" # use whatever region is relevant for you
}
```

Then re-initialize so the AWS provider is installed, and format:

```bash
terraform init
terraform fmt
```

---

### Step 4 — Create an S3 bucket

Create a new file **`s3.tf`** defining the bucket. Use the `random_id` so the (globally unique) bucket name is recognizable as coming from Terraform Cloud, and tag it:

```hcl
resource "aws_s3_bucket" "tf_cloud" {
  bucket = "terraform-cloud-${random_id.this.hex}"

  tags = {
    created_by = "terraform-cloud"
  }
}
```

**What this does:**

| Element | Meaning |
| --- | --- |
| `bucket` | The S3 bucket name. S3 names are **globally unique**, so the `random_id` hex suffix avoids collisions. |
| `random_id.this.hex` | Reuses the random id from `random.tf` so this bucket clearly ties back to this project. |
| `tags.created_by` | A tag marking the bucket as created by Terraform Cloud. |

---

### Step 5 — Apply through Terraform Cloud

Run the apply and confirm it in the UI:

```bash
terraform apply
```

- In the Terraform Cloud UI a run appears, status **planned**, proposing to **add an `aws_s3_bucket`**. Seeing the plan succeed means **authentication to AWS worked**.
- Open the run, **Confirm & Apply**, comment *"Looks good to me."*, and confirm the plan. Wait for the apply to finish.

> ✅ Success check: the resource is added. In the AWS Console → **S3**, your `terraform-cloud-<hex>` bucket exists.
> 

---

### Step 6 — (Optional experiment) Break the credentials on purpose

This shows what happens when the remote agent **can't** authenticate.

1. In Terraform Cloud → **Variables**, **delete** the `AWS_ACCESS_KEY_ID` variable (confirm the delete).
2. Run `terraform apply` again.

The run **fails** with this exact error:

```
No valid credential sources found
```

Because the key was removed, the agent running your Terraform has no way to log in to AWS. In the workspace **Overview** the run shows **errored**; opening it shows the same `No valid credential sources found` in the logs.

**Restore it:** go back to IAM → your user → Security credentials, copy the **Terraform Cloud** access key **ID**, then in Terraform Cloud add the environment variable `AWS_ACCESS_KEY_ID` again with that value, **mark it sensitive**, and add it.

> ℹ️ The variable name is `AWS_ACCESS_KEY_ID` — copy the **name** as well as the value when recreating it.
> 

---

## Congratulations on Completing the Exercise!

You learned that remote Terraform Cloud agents don't see your local environment, so AWS credentials must live in the **workspace** as **sensitive environment variables**. You created a real **S3 bucket** through Terraform Cloud, and proved the credential dependency by deleting a key and watching the `No valid credential sources found` error. These are **environment** variables (consumed by the agent), not Terraform variables.

> ⚠️ Static access keys are fine for short experiments only. For sustainable, long-term automation use **OIDC + short-lived credentials** (covered in its own project). **Delete the access key** from IAM when you're done experimenting.
> 

> 🧹 This lab creates a **real, billable** S3 bucket. When finished, run `terraform destroy` (confirm in the UI) to remove it, and delete the temporary IAM access key.
> 
