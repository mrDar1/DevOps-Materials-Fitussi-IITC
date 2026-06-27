## Introduction

In [12.4](../12.4%20-%20Authenticating%20to%20AWS%20with%20Environment%20Variables%20and%20Creating%20an%20S3%20Bucket/lab.md) you added **environment variables** to the workspace so the remote agent could authenticate to AWS. Environment variables are populated *in the agent's shell*. Terraform Cloud also supports **Terraform variables** — values fed into `var.*` inside your configuration. This lab uses one to drive an EC2 instance type, then deploys and destroys an instance.

This lab covers:

- **Terraform variables vs environment variables** — environment variables live in the agent's environment; **Terraform variables** populate your `variable` blocks (`var.<name>`).
- **A validated input** — a `validation` block that rejects anything but `t2.micro` to stay in the free tier.
- **Supplying the value from Terraform Cloud** — define the `variable` with **no default**, set its value in the workspace, and watch the remote plan pick it up.
- **Full create + destroy** — deploy an EC2 instance (AMI from a data source) and then destroy everything.

> 💡 Building on 12.4: same workspace, same AWS credentials. We add a *Terraform* variable this time, not an environment variable.
> 

## Desired Outcome

By the end you will have:

1. A **`variables.tf`** with an `ec2_instance_type` string variable, **no default**, validated to equal `t2.micro`.
2. The value `t2.micro` supplied via a **Terraform variable** in the Terraform Cloud workspace.
3. A **`compute.tf`** with a Ubuntu **AMI data source** and an `aws_instance` whose `instance_type` is `var.ec2_instance_type`, tagged `Name = terraform-cloud`.
4. A remote plan that shows `t2.micro` correctly populated, an applied EC2 instance, and finally a **`terraform destroy`** removing all resources.

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- Completed [12.4](../12.4%20-%20Authenticating%20to%20AWS%20with%20Environment%20Variables%20and%20Creating%20an%20S3%20Bucket/lab.md): workspace with AWS credential **environment variables** and the AWS provider configured.
- Permission to launch EC2 instances in your region.

---

## Step-by-Step Guide

### Step 1 — Declare a validated Terraform variable

Create **`variables.tf`** so the configuration can retrieve and use the value:

```hcl
variable "ec2_instance_type" {
  type = string

  validation {
    condition     = var.ec2_instance_type == "t2.micro"
    error_message = "Please use t2.micro to stay within the free tier."
  }
}
```

**What this does:**

| Element | Meaning |
| --- | --- |
| `type = string` | The variable holds a string instance type. |
| no `default` | Intentional — we want the value to come **from Terraform Cloud**, not from the code. |
| `validation.condition` | Requires the value to be exactly `t2.micro`. |
| `error_message` | Shown if the condition fails, keeping you in the free tier. |

> 💡 You *could* set a `default` here, but the whole point is to see the value flow in from the workspace.
> 

---

### Step 2 — Set the value as a Terraform variable in the workspace

In Terraform Cloud, open your workspace → **Variables** → **Add variable** → choose **Terraform variable** (not environment variable):

- Key: `ec2_instance_type`
- Value: `t2.micro`
- Leave **HCL** unchecked.

Add the variable.

> ℹ️ The **HCL** checkbox tells Terraform Cloud to interpret the value as HashiCorp Configuration Language (so you could pass lists/maps or interpolate). A plain string like `t2.micro` doesn't need it.
> 

---

### Step 3 — Define the AMI data source and EC2 instance

Create **`compute.tf`** with a Ubuntu AMI data source and an `aws_instance` that uses the variable:

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

resource "aws_instance" "tf_cloud" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.ec2_instance_type

  tags = {
    Name = "terraform-cloud"
  }
}
```

**What this does:**

- `data "aws_ami" "ubuntu"` — looks up the latest Ubuntu 22.04 AMI from Canonical, so you don't hardcode an AMI id.
- `instance_type = var.ec2_instance_type` — pulls the value from the **workspace Terraform variable** (`t2.micro`).
- `tags.Name = "terraform-cloud"` — marks the instance as coming from Terraform Cloud.

---

### Step 4 — Apply and confirm the variable is picked up

Run the apply and inspect the plan in Terraform Cloud:

```bash
terraform apply
```

- In the workspace **Overview**, the latest run is in the **planning** stage. Open it and wait for planning to finish.
- Scroll the plan — you should see the `instance_type` resolved to **`t2.micro`**, confirming the value was populated from the workspace Terraform variable.
- **Confirm & Apply**, comment *"Looks good to me."*, confirm the plan.

> ℹ️ EC2 instances take longer to create than the earlier resources — expect roughly **40 seconds to a minute**.
> 

> ✅ Success check: after the apply finishes, the AWS Console → **EC2** shows the `terraform-cloud` instance **running**.
> 

---

### Step 5 — Destroy everything

Clean up so nothing keeps running:

```bash
terraform destroy
```

- A **CLI-triggered destroy** run appears in the workspace **Overview**.
- The plan lists the resources to remove. The workspace holds **four** items — an S3 bucket, the Ubuntu AMI **data source**, the `aws_instance`, and the `random_id` — but the destroy plans to remove **three** of them.

> ℹ️ The **AMI data source is not destroyed** — a data source only *reads* information, so there's nothing to delete.
> 

- **Confirm & Apply** the destroy, comment *"Looks good to me."*, confirm the plan, and wait for it to complete.

> ✅ Success check: in the AWS Console → EC2 (clear any filters), the `terraform-cloud` instance is in the **terminated** state.
> 

---

## Congratulations on Completing the Exercise!

You used a **Terraform variable** (distinct from an environment variable) defined in the Terraform Cloud workspace to drive your configuration, protected it with a `validation` block, and deployed a real EC2 instance whose AMI came from a data source. You confirmed the value flowed in from the workspace, then destroyed all resources from the CLI through Terraform Cloud — noting that the **data source isn't a destroyable resource**.

> 🧹 This lab creates a **real, billable** EC2 instance (and reuses the S3 bucket from 12.4). The lab ends with `terraform destroy` — make sure it completes and the instance shows **terminated** so nothing keeps billing.
> 
