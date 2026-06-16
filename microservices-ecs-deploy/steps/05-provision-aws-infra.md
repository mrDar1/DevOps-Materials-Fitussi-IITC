# Step 05 — Provision the AWS infrastructure

**Goal:** create, **from scratch in the AWS Console**, every AWS resource the
pipeline deploys *into*. Nothing here is pre-provisioned for you — by the end the
ECR repos, ECS cluster, Service Connect namespace, load balancer, and both ECS
services exist and are wired together, ready for the pipeline in
[Step 06](06-write-the-pipeline.md) to push images and roll out new task
definitions.

> **Pick a region and stick to it.** Everything below — ECR, ECS, the ALB, log
> groups — must live in the **same AWS region**. This lab assumes `eu-west-1`;
> if you choose another, use it everywhere (including the workflow `env` in
> Step 06 and the `<REGION>` placeholders in the task definitions).

> **Why so much by hand?** Doing it once in the console shows you exactly what a
> running ECS service is made of — a cluster, a task definition, a service,
> networking, and discovery. Teams later codify this in Terraform/CDK, but you
> can't automate what you don't understand.

---

## A. The task-definition placeholders

Open both `inventory-service/task-definition.json` and
`orders-service/task-definition.json`. They contain placeholders you must fill
in with **your** account's values:

- [ ] `<ACCOUNT_ID>` → your 12-digit AWS account ID
- [ ] `<REGION>` → your region (e.g. `eu-west-1`)

These appear in the `executionRoleArn`, the container `image` URI, and the
`awslogs-region`. Keep the file's container `name` (`inventory` / `orders`)
unchanged — the pipeline's render step matches on it.

> You'll keep coming back to these two files as you create resources below; the
> names you choose in AWS must line up with what's written here.

---

## B. The task execution role

ECS needs an **execution role** to pull images from ECR and write logs to
CloudWatch. The task definitions reference `ecsTaskExecutionRole`.

In **IAM → Roles → Create role**:

- [ ] Trusted entity: **AWS service** → **Elastic Container Service** →
      **Elastic Container Service Task**
- [ ] Attach the managed policy **`AmazonECSTaskExecutionRolePolicy`**
- [ ] Name it exactly `ecsTaskExecutionRole`

> This is **different** from the GitHub deploy role in [Step 04](04-github-repo.md):
> the deploy role is assumed by GitHub Actions to *run the deploy*; the execution
> role is assumed by ECS at runtime to *pull the image and ship logs*.

---

## C. Create the two ECR repositories

The pipeline pushes one image per service. In **ECR → Repositories → Create
repository**, create **two private repos**, named to match the workflow:

- [ ] `inventory-service`
- [ ] `orders-service`

> The image URIs in the task definitions and the workflow are
> `<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<repo>:<tag>`. The repo name here
> must match the `<repo>` segment exactly.

---

## D. Create the CloudWatch log groups

Each task definition logs to a named group. CloudWatch can auto-create them, but
create them explicitly so the first deploy doesn't fail on a missing group. In
**CloudWatch → Log groups → Create log group**:

- [ ] `/ecs/inventory-service`
- [ ] `/ecs/orders-service`

---

## E. Create the ECS cluster

In **ECS → Clusters → Create cluster**:

- [ ] Name it `microsvc-cluster` (this is the `ECS_CLUSTER` value the workflow
      uses — keep them identical)
- [ ] Infrastructure: **AWS Fargate (serverless)**
- [ ] Create it in a VPC with at least two subnets (the default VPC is fine)

---

## F. Register the first task definition revisions

The pipeline updates **existing** services with new task-def revisions, so the
services (and therefore an initial task definition) must already exist. Register
revision 1 of each from your filled-in JSON. In **ECS → Task definitions →
Create new task definition → JSON**:

- [ ] Paste the contents of `inventory-service/task-definition.json` (with your
      `<ACCOUNT_ID>`/`<REGION>` filled in) and create it
- [ ] Do the same for `orders-service/task-definition.json`

> The `image` tag can stay `latest` for this first registration — the pipeline
> overwrites it with a commit-SHA tag on every deploy.

---

## G. Set up Service Connect (private service discovery)

`orders` finds `inventory` by the DNS name `inventory.microsvc.local:8080`. That
name comes from **ECS Service Connect**, backed by a **Cloud Map** namespace.

- [ ] In **AWS Cloud Map → Create namespace**, create an
      **API calls and DNS queries in VPCs** namespace named `microsvc.local`,
      attached to your cluster's VPC.

You'll enable Service Connect on each service in the next step and point it at
this namespace.

---

## H. Create the two ECS services

This is where it all comes together. In **ECS → Clusters → `microsvc-cluster` →
Services → Create**, create **two** services.

**`inventory-service` (internal, no load balancer):**

- [ ] Launch type: **Fargate**
- [ ] Task definition: `inventory-service` (the revision from Section F)
- [ ] Service name: `inventory-service`
- [ ] Desired tasks: `1`
- [ ] **Service Connect:** enable it, namespace `microsvc.local`. Configure the
      `inventory` port mapping as a **client and server** with the discovery name
      `inventory` on port `8080` → this is what makes `inventory.microsvc.local:8080` resolve.
- [ ] **No** load balancer — it's reached only by `orders`.
- [ ] Networking: place it in the cluster's subnets; security group must allow
      inbound TCP `8080` **from the orders/service security group** (so orders
      can call it).

**`orders-service` (public, behind an ALB):**

- [ ] Launch type: **Fargate**
- [ ] Task definition: `orders-service`
- [ ] Service name: `orders-service`
- [ ] Desired tasks: `1`
- [ ] **Service Connect:** enable it with the same `microsvc.local` namespace
      (as a **client** so it can resolve `inventory`).
- [ ] **Load balancing:** create a new **Application Load Balancer**, listener on
      port `80`, forwarding to a target group on container port `8080` with
      health-check path `/health`.
- [ ] Networking: security group must allow inbound TCP `80` from the internet
      (via the ALB) and be allowed to reach `inventory` on `8080`.
- [ ] Set the env var `INVENTORY_URL=http://inventory.microsvc.local:8080` on the
      task (if it isn't already in your task definition).

> **Why `inventory` has no ALB but `orders` does** — only `orders` is meant to be
> public. `inventory` is an internal dependency, reachable solely over Service
> Connect. This is the same public/private split you modeled locally in
> [Step 03](03-compose-local.md), where only `orders` published a host port.

When both services reach `running == desired` and the ALB target group shows
`orders` **healthy**, your infrastructure is ready. Note the **ALB DNS name** —
you'll hit it in [Step 07](07-deploy-and-verify.md).

---

## What you learned

- A running ECS service is an assembly of distinct parts: a cluster, a task
  definition (with an execution role and log group), an ECR image, networking,
  and — for service-to-service calls — a Service Connect namespace. The
  public/private split (ALB on `orders`, Service Connect only for `inventory`)
  is a deliberate architecture choice, not an accident of configuration.

## Checklist

- [ ] `<ACCOUNT_ID>` and `<REGION>` filled into both `task-definition.json` files
- [ ] `ecsTaskExecutionRole` exists with `AmazonECSTaskExecutionRolePolicy`
- [ ] ECR repos `inventory-service` and `orders-service` exist
- [ ] Log groups `/ecs/inventory-service` and `/ecs/orders-service` exist
- [ ] Cluster `microsvc-cluster` exists on Fargate
- [ ] A revision of each task definition is registered
- [ ] Cloud Map namespace `microsvc.local` exists, attached to the cluster's VPC
- [ ] `inventory-service` runs with Service Connect, **no** ALB
- [ ] `orders-service` runs behind an ALB, can reach `inventory` on `8080`
- [ ] You have the **ALB DNS name** noted for Step 07

## Next

→ [Step 06 — Write the deploy pipeline](06-write-the-pipeline.md)
