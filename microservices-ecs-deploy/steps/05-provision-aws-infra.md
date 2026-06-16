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

You'll build the resources in the order below. Each one is needed by the next,
so **don't skip ahead** — register the task definitions before you create the
services, create the namespace before you enable Service Connect, and so on.

Resources you'll create, and how they connect:

```
ecsTaskExecutionRole ─┐
ECR repos ────────────┤
CloudWatch log groups ┤──► task definitions ──► ECS services ──► ALB (orders only)
Cloud Map namespace ──┘                                   └──► Service Connect
```

---

## A. Fill in the task-definition placeholders

Before touching the console, edit the two task-definition files so they point at
**your** account. Open `inventory-service/task-definition.json` and
`orders-service/task-definition.json` and replace:

- [ ] `<ACCOUNT_ID>` → your 12-digit AWS account ID (the digits in your deploy
      role ARN from [Step 04](04-github-repo.md), e.g. `050752632489`)
- [ ] `<REGION>` → your region, e.g. `eu-west-1`

These placeholders appear in three places per file: `executionRoleArn`, the
container `image` URI, and `awslogs-region`. **Leave everything else as-is** — in
particular the container `name` (`inventory` / `orders`) and `family`, which the
pipeline matches on later.

> Keep these files open. The names you choose in the console below — the ECR repo
> name, the log-group name, the execution-role name — must match exactly what's
> written in this JSON, or the first deploy fails.

---

## B. Create the task execution role

ECS itself needs an **execution role** to pull your image from ECR and write
container logs to CloudWatch. Your task definitions already reference it by name
(`ecsTaskExecutionRole` in `executionRoleArn`), so create it with that exact
name.

1. Open the **IAM** console → **Roles** → **Create role**.
2. **Trusted entity type:** select **AWS service**.
3. Under **Use case**, choose **Elastic Container Service**, then select
   **Elastic Container Service Task** from the list → **Next**.
4. On **Add permissions**, search for and tick **`AmazonECSTaskExecutionRolePolicy`**
   → **Next**.
5. **Role name:** enter exactly `ecsTaskExecutionRole` → **Create role**.

> **Not the same role as Step 04.** The Step 04 `github-actions-deploy` role is
> assumed by *GitHub Actions* to run the deploy. This `ecsTaskExecutionRole` is
> assumed by *ECS at runtime* to pull the image and ship logs. Two different
> actors, two different roles.

---

## C. Create the two ECR repositories

The pipeline pushes one container image per service into ECR. You'll create two
**private** repositories: `inventory-service` and `orders-service`.

> **Region check — do this first.** Look at the URI prefix shown next to the
> repository-name field (e.g. `…dkr.ecr.eu-central-1.amazonaws.com/`). That region
> is whatever the console's region selector (top-right) is set to. It **must match
> the `<REGION>` you used in your task-definition JSON** (Section A) and the region
> you'll use everywhere else. If the prefix shows a different region than you
> intend, fix the region selector *before* creating the repo — you can't move a
> repository between regions later.

1. Open the **Amazon ECR** console. In the left sidebar under **Private registry**,
   choose **Repositories**. (If you land on a "Get started" splash, click
   **Get started** to reach the repositories list.)
2. Click **Create repository** in the top-right.
3. On the **Create repository** page:
   - **Repository name:** type `inventory-service` in the name field. The
     non-editable URI prefix to its left
     (`<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/`) is filled in automatically —
     check it shows your account ID and region (see the region note above).
   - **Image tag settings → Image tag mutability:** leave on the default
     **Mutable** (the pipeline re-pushes tags, so tags must be overwritable). Leave
     **Mutable tag exclusions** empty.
   - **Encryption settings → Encryption configuration:** leave on the default
     **AES-256**. (No need for AWS KMS in this lab.)
   - Leave any remaining sections (e.g. the deprecated image-scanning settings) at
     their defaults.
4. Click **Create repository** (bottom-right). You're returned to the repositories
   list with `inventory-service` now listed.
5. Click **Create repository** again and repeat step 3 with the name
   `orders-service`.

When done, the **Private** repositories list shows both `inventory-service` and
`orders-service`, each with a URI of the form
`<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<name>`.

> The full image URI is
> `<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<repo>:<tag>`. The repo name you
> type here is the `<repo>` segment and must match the `image` line in the
> task-definition JSON exactly.

---

## D. Create the two CloudWatch log groups

Each task definition writes logs to a named group (`awslogs-group`). ECS can
auto-create them, but creating them up front avoids a first-deploy failure if the
execution role can't create the group.

1. Open the **CloudWatch** console → **Log groups** → **Create log group**.
2. **Log group name:** `/ecs/inventory-service` → **Create**.
3. Repeat for `/ecs/orders-service`.

---

## E. Create the ECS cluster

1. Open the **Amazon ECS** console → **Clusters** → **Create cluster**.
2. **Cluster name:** `microsvc-cluster`.
   > This must equal the `ECS_CLUSTER` value in your workflow in Step 06 — keep
   > them identical.
3. Under **Infrastructure**, ensure **AWS Fargate (serverless)** is selected
   (it's on by default).
4. Leave the default VPC and subnets selected (the default VPC, with its subnets
   across availability zones, is fine for this lab) → **Create**.

> Note which **VPC** the cluster uses — you'll attach the Cloud Map namespace
> (Section G) to the *same* VPC, and the ALB (Section H) lives there too.

---

## F. Create the Cloud Map namespace for service discovery

`orders` will reach `inventory` at the DNS name `inventory.microsvc.local`. That
hostname is served by **AWS Cloud Map**; ECS Service Connect (Section H) plugs
into it. Create the namespace first so it's selectable when you create the
services.

1. Open the **AWS Cloud Map** console → **Create namespace**.
2. **Namespace name:** `microsvc.local`.
3. **Instance discovery:** select **API calls and DNS queries in VPCs**.
4. **VPC:** choose the **same VPC** your cluster uses (from Section E).
5. **Create namespace.**

> `microsvc.local` is the DNS suffix; the `inventory` part of
> `inventory.microsvc.local` comes from the Service Connect *discovery name* you
> set on the inventory service in Section H.

---

## G. Register the first task-definition revisions

The pipeline **updates existing** ECS services — it doesn't create them — so the
services must exist before the first deploy, and a service can't be created
without a task definition. Register revision 1 of each now, from your edited
JSON.

1. Open the **Amazon ECS** console → **Task definitions** → **Create new task
   definition** → **Create new task definition with JSON**.
2. Delete the sample JSON, paste the full contents of
   `inventory-service/task-definition.json` (with your `<ACCOUNT_ID>`/`<REGION>`
   filled in from Section A) → **Create**.
3. Repeat for `orders-service/task-definition.json`.

After this you should see two task-definition families — `inventory-service` and
`orders-service` — each at revision `1`.

> The `image` tag can stay `:latest` for this first registration. The pipeline
> overwrites it with a commit-SHA tag on every deploy, then ECS rolls the service
> to the new revision.

---

## H. Create the two ECS services

This is where the cluster, task definitions, namespace, and networking come
together. You create **two** services in `microsvc-cluster`. Create
**`inventory-service` first** (orders depends on it).

### H.1 — `inventory-service` (internal — no load balancer)

1. In the **ECS** console open **Clusters → `microsvc-cluster`**, and on the
   **Services** tab choose **Create**.
2. **Compute / launch type:** **Launch type**, **FARGATE**.
3. **Deployment configuration:**
   - **Family:** `inventory-service`, **Revision:** `1` (latest).
   - **Service name:** `inventory-service`.
   - **Desired tasks:** `1`.
4. **Networking:** choose your cluster's VPC and its subnets. For the **security
   group**, create a new one (call it `inventory-sg`) — you'll adjust its inbound
   rule in step 6. **Public IP:** can be **on** for the default VPC's public
   subnets so the image can be pulled (or use private subnets with a NAT —
   public is simplest for the lab).
5. **Service Connect:** expand it and choose **Turn on Service Connect**.
   - **Namespace:** `microsvc.local`.
   - For the port mapping named `inventory` (it comes from the task definition),
     set the role to **Client and server** and the **Discovery name** /
     **Service Connect alias** to `inventory` on **port 8080**.
   - This is exactly what makes `http://inventory.microsvc.local:8080` resolve.
6. **No load balancer** — leave load balancing off; inventory is reached only by
   orders. Create the service.
7. **Open the inbound rule** so orders can call it: in **EC2 → Security Groups**,
   edit `inventory-sg` → **Inbound rules** → add **Custom TCP, port 8080**, and
   for **Source** pick the orders service's security group. You don't have that
   group yet, so come back to this after H.2 (or temporarily allow the VPC CIDR,
   then tighten it).

### H.2 — `orders-service` (public — behind an Application Load Balancer)

1. **Clusters → `microsvc-cluster` → Services → Create** again.
2. **Launch type:** **FARGATE**.
3. **Deployment configuration:**
   - **Family:** `orders-service`, **Revision:** `1`.
   - **Service name:** `orders-service`.
   - **Desired tasks:** `1`.
4. **Networking:** same VPC/subnets. Create a new security group `orders-sg`.
5. **Service Connect:** **Turn on Service Connect**, **Namespace:**
   `microsvc.local`, role **Client only** (orders calls inventory but nothing
   discovers orders by name).
6. **Load balancing:** choose **Application Load Balancer** → **Create a new load
   balancer**.
   - **Load balancer name:** e.g. `orders-alb`.
   - **Listener:** port **80**, protocol **HTTP**.
   - **Target group:** new, protocol **HTTP**, the container **port 8080**,
     **Health check path:** `/health`.
7. Create the service. ECS creates the ALB, target group, and registers the
   orders task.
8. **Finish the inventory inbound rule (from H.1 step 7):** edit `inventory-sg`'s
   port-8080 inbound rule so its **Source** is `orders-sg`. Also confirm the
   **ALB's** security group allows inbound **port 80 from `0.0.0.0/0`** (the
   console usually creates this for you) so the internet can reach orders.

> **`INVENTORY_URL`** — orders reads this to find inventory. The provided
> `orders-service/task-definition.json` should set it to
> `http://inventory.microsvc.local:8080`; confirm it's there. (Locally in
> [Step 03](03-compose-local.md) it was `http://inventory:8080` — same idea,
> different DNS namespace.)

> **Why inventory has no ALB but orders does** — only `orders` is public.
> `inventory` is an internal dependency reachable solely over Service Connect.
> Same public/private split you modeled locally in
> [Step 03](03-compose-local.md), where only `orders` published a host port.

### H.3 — Confirm it's healthy

- In **ECS → `microsvc-cluster` → Services**, both `inventory-service` and
  `orders-service` should reach **running count = desired count (1)**.
- In **EC2 → Target Groups**, the orders target group should list its task as
  **healthy** (this means `/health` returned 200 through the ALB).
- Copy the **ALB DNS name** from **EC2 → Load Balancers → `orders-alb` → DNS
  name** (looks like `orders-alb-123456.eu-west-1.elb.amazonaws.com`). You'll
  curl it in [Step 07](07-deploy-and-verify.md).

---

## What you learned

- A running ECS service is an assembly of distinct parts: a cluster, a task
  definition (with an execution role and log group), an ECR image, networking,
  and — for service-to-service calls — a Service Connect namespace. The
  public/private split (ALB on `orders`, Service Connect only for `inventory`)
  is a deliberate architecture choice, not an accident of configuration.

## Checklist

- [ ] (A) `<ACCOUNT_ID>` and `<REGION>` filled into both `task-definition.json` files
- [ ] (B) `ecsTaskExecutionRole` exists with `AmazonECSTaskExecutionRolePolicy`
- [ ] (C) ECR repos `inventory-service` and `orders-service` exist (Private)
- [ ] (D) Log groups `/ecs/inventory-service` and `/ecs/orders-service` exist
- [ ] (E) Cluster `microsvc-cluster` exists on Fargate
- [ ] (F) Cloud Map namespace `microsvc.local` exists, attached to the cluster's VPC
- [ ] (G) A revision of each task definition (`inventory-service`, `orders-service`) is registered
- [ ] (H.1) `inventory-service` runs with Service Connect, **no** ALB
- [ ] (H.2) `orders-service` runs behind an ALB, with `inventory-sg` allowing 8080 from `orders-sg`
- [ ] (H.3) Both services show running == desired; orders target group is **healthy**
- [ ] (H.3) You have the **ALB DNS name** noted for Step 07

## Next

→ [Step 06 — Write the deploy pipeline](06-write-the-pipeline.md)
