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

1. Open the **IAM** console. In the left sidebar choose **Roles**, then click
   **Create role** (top-right).
2. **Step 1 — Select trusted entity.** Under **Trusted entity type** choose
   **AWS service**.
3. Under **Use case**, open the **Service or use case** dropdown and pick
   **Elastic Container Service**. A new set of radio options appears below it —
   select **Elastic Container Service Task** → **Next**.
4. **Step 2 — Add permissions.** In the **Permissions policies** search box type
   `AmazonECSTaskExecutionRolePolicy`, tick its checkbox in the results → **Next**.
5. **Step 3 — Name, review, and create.** In **Role name** enter exactly
   `ecsTaskExecutionRole`. Leave the description and the trust policy as generated,
   scroll to the bottom → **Create role**.

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

> **Same region.** The CloudWatch region selector (top-right) must show the same
> region as your `awslogs-region` in the task-definition JSON.

1. Open the **CloudWatch** console. In the left sidebar expand **Logs** and choose
   **Log groups**, then click **Create log group** (top-right).
2. **Log group name:** enter `/ecs/inventory-service`. Leave **Log class** on the
   default **Standard** and **Retention setting** on **Never expire** (or pick a
   retention if you prefer) → **Create**.
3. Click **Create log group** again and repeat with the name `/ecs/orders-service`.

---

## E. Create the ECS cluster

1. Open the **Amazon ECS** console. In the left sidebar choose **Clusters**, then
   click **Create cluster** (top-right).
2. **Cluster configuration → Cluster name:** `microsvc-cluster`.
   > This must equal the `ECS_CLUSTER` value in your workflow in Step 06 — keep
   > them identical.
3. **Infrastructure:** leave **AWS Fargate (serverless)** ticked (it's on by
   default). Leave **Amazon EC2 instances** and **External instances** unticked.
4. Leave **Monitoring** and **Tags** at their defaults → **Create** (bottom-right).
   Cluster creation takes a few seconds; wait for the status to show **Active**.

> The new ECS console does **not** ask you to pick a VPC or subnets when creating
> the cluster — that happens later, when you create each service (Section H).
> Cloud Map (Section F) is what ties everything to a VPC, so just make sure the
> namespace and the services all use the **same VPC** (the default VPC is fine for
> this lab).

---

## F. Create the Cloud Map namespace for service discovery

`orders` will reach `inventory` at the DNS name `inventory.microsvc.local`. That
hostname is served by **AWS Cloud Map**; ECS Service Connect (Section H) plugs
into it. Create the namespace first so it's selectable when you create the
services.

1. Open the **AWS Cloud Map** console and click **Create namespace** (top-right).
2. **Namespace name:** `microsvc.local`. Leave **Namespace description** blank.
3. **Instance discovery** — choose **API calls and DNS queries in VPCs**. (This is
   the option that creates a private DNS hosted zone tied to a VPC; the
   alternatives are *API calls only* and *API calls and public DNS queries*, which
   we don't want.)
4. A **VPC** dropdown appears. Choose the **default VPC** in your region — the same
   VPC you'll select for both services in Section H. (In the new ECS console the
   cluster has no VPC of its own, so the VPC you pick *here* is what binds the
   namespace, the services, and the ALB together.)
5. Click **Create namespace.**

> `microsvc.local` is the DNS suffix; the `inventory` part of
> `inventory.microsvc.local` comes from the Service Connect *discovery name* you
> set on the inventory service in Section H.

---

## G. Register the first task-definition revisions

The pipeline **updates existing** ECS services — it doesn't create them — so the
services must exist before the first deploy, and a service can't be created
without a task definition. Register revision 1 of each now, from your edited
JSON.

1. Open the **Amazon ECS** console → **Task definitions** (left sidebar).
2. Click the **Create new task definition** dropdown (top-right) and choose
   **Create new task definition with JSON**. A JSON editor opens, pre-filled with a
   sample.
3. Select all of the sample JSON and delete it, then paste the **full** contents of
   `inventory-service/task-definition.json` (with your `<ACCOUNT_ID>` / `<REGION>`
   filled in from Section A). Click **Create** (bottom-right).
4. Repeat steps 1–3 for `orders-service/task-definition.json`.

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

> **About the new service wizard.** The page is one long form split into
> collapsible sections: **Environment**, **Deployment configuration**,
> **Networking**, **Load balancing**, and **Service Connect** (the last two are
> collapsed by default — expand them). Work top to bottom.

### H.1 — `inventory-service` (internal — no load balancer)

1. In the **ECS** console open **Clusters → `microsvc-cluster`**. On the
   **Services** tab click **Create**.
2. **Environment → Compute configuration:** select **Launch type** (not *Capacity
   provider strategy*). **Launch type:** **FARGATE**. Leave **Platform version** on
   **LATEST**.
3. **Deployment configuration:**
   - **Application type:** **Service**.
   - **Task definition → Family:** `inventory-service`; **Revision:** `1 (LATEST)`.
   - **Service name:** `inventory-service`.
   - **Desired tasks:** `1`.
4. **Networking** (expand it):
   - **VPC:** the **default VPC** — the same one you bound the Cloud Map namespace
     to in Section F.
   - **Subnets:** leave all the default public subnets selected.
   - **Security group:** choose **Create a new security group**, name it
     `inventory-sg`, description anything. Remove any inbound rule it pre-fills —
     you'll set the real one in step 7.
   - **Public IP:** **Turned on**. (On the default VPC's public subnets this lets
     Fargate pull the image from ECR without a NAT gateway — simplest for the lab.)
5. **Service Connect** (expand it): tick **Use Service Connect**.
   - **Service Connect configuration → Namespace:** select `microsvc.local`.
   - Choose the **Client and server** mode (inventory both serves traffic and may
     call out).
   - Under **Port mapping**, the row for the task definition's `inventory` port
     (container port **8080**) appears. Tick it to add a Service Connect entry and
     set **Service Connect alias → Port alias / DNS:** `inventory`, **Port:**
     `8080`. This is exactly what makes `http://inventory.microsvc.local:8080`
     resolve.
6. **Load balancing:** leave it **off** (the **Load balancer type** stays **None**)
   — inventory is reached only by orders, over Service Connect. Click **Create**
   (bottom-right).
7. **Open the inbound rule** so orders can reach it later: go to **EC2 → Security
   Groups**, select `inventory-sg` → **Inbound rules** tab → **Edit inbound rules**
   → **Add rule**: **Type** = **Custom TCP**, **Port range** = `8080`, **Source** =
   the `orders-sg` group. You haven't created `orders-sg` yet, so either come back
   here after H.2, **or** for now set **Source** to the VPC CIDR and tighten it to
   `orders-sg` after H.2.

### H.2 — `orders-service` (public — behind an Application Load Balancer)

1. **Clusters → `microsvc-cluster` → Services tab → Create** again.
2. **Environment → Compute configuration:** **Launch type**, **FARGATE**,
   **Platform version** **LATEST**.
3. **Deployment configuration:**
   - **Application type:** **Service**.
   - **Task definition → Family:** `orders-service`; **Revision:** `1 (LATEST)`.
   - **Service name:** `orders-service`.
   - **Desired tasks:** `1`.
4. **Networking** (expand): same **default VPC** and subnets. **Security group:**
   **Create a new security group** named `orders-sg`. **Public IP:** **Turned on**.
5. **Load balancing** (expand):
   - **Load balancer type:** **Application Load Balancer**.
   - Choose **Create a new load balancer**.
   - **Load balancer name:** `orders-alb`.
   - **Health check grace period:** leave default (e.g. `60`).
   - **Listener:** **Create new listener** — **Port** `80`, **Protocol** **HTTP**.
   - **Target group:** **Create new target group** — **Name** e.g. `orders-tg`,
     **Protocol** **HTTP**, and set the **Health check path** to `/health`. (The
     target port follows the container's `orders` port mapping — **8080**.)
6. **Service Connect** (expand): tick **Use Service Connect**, **Namespace:**
   `microsvc.local`, mode **Client side only** (orders calls inventory, but nothing
   needs to discover orders by name — the public entry point is the ALB).
7. Click **Create**. ECS provisions the ALB, listener, and target group, then
   launches the orders task and registers it as a target.
8. **Finish the inventory inbound rule (from H.1 step 7):** in **EC2 → Security
   Groups**, edit `inventory-sg`'s port-8080 inbound rule so its **Source** is the
   `orders-sg` group (replace the temporary VPC-CIDR source if you used one). Also
   confirm the **ALB's** security group has an inbound rule allowing **HTTP port 80
   from `0.0.0.0/0`** (ECS usually creates this automatically) so the internet can
   reach orders.

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
