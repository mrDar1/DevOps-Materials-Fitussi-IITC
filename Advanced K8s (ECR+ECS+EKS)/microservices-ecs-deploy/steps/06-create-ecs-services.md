# Step 06 — Create the ECS services

**Goal:** create the two ECS services in `microsvc-cluster`, wiring together the
task definitions, Service Connect namespace, security groups, and load balancer
you built in [Step 05](05-provision-aws-infra.md).

> The ECR repos are still empty, so the services **won't run yet** — they pull
> their image only after the pipeline pushes one in [Step 07](07-write-the-pipeline.md),
> and you confirm they're healthy in [Step 08](08-deploy-and-verify.md). Here you
> just define the services and their networking.

Create **`inventory-service` first** (orders depends on it).

---

## A. `inventory-service` (internal — no load balancer)

Work top to bottom through the wizard sections.

1. **ECS → Clusters → `microsvc-cluster` → Services tab → Create**.
2. **Service details:**
   - **Task definition family:** `inventory-service`.
   - **Task definition revision:** `1 (LATEST)`.
   - **Service name:** `inventory-service`.
3. **Environment → Compute configuration:** **Compute options** = **Launch type**, **Launch type** = **Fargate**, **Platform version** = **LATEST**.
4. **Deployment configuration:**
   - **Scheduling strategy:** **Replica**.
   - **Desired tasks:** `1`.
   - Leave **Availability Zone rebalancing** and **Health check grace period** at defaults.
5. **Networking** (expand):
   - **VPC:** default VPC.
   - **Subnets:** leave all default public subnets selected.
   - **Security group:** **Use an existing security group** → **`inventory-sg`** (no other group selected).
   - **Public IP:** **Turned on**.
6. **Service Connect** (expand): tick **Use Service Connect**.
   - **Service Connect configuration:** **Client and server**.
   - **Namespace:** select `microsvc.local`.
   - Under **Service Connect Service - 1**:
     - **Port alias:** select `inventory` (the task-definition port-mapping name).
     - **Discovery:** `inventory`.
     - **DNS:** `inventory` (this is what makes `inventory.microsvc.local` resolve).
     - **Port:** `8080`.
   - Leave traffic encryption off.
7. **Load balancing:** leave it **off** (no load balancer).
8. Leave the remaining optional sections at defaults → **Create**.

---

## B. `orders-service` (public — behind an Application Load Balancer)

1. **Clusters → `microsvc-cluster` → Services tab → Create**.
2. **Service details:**
   - **Task definition family:** `orders-service`.
   - **Task definition revision:** `1 (LATEST)`.
   - **Service name:** `orders-service`.
3. **Environment → Compute configuration:** **Compute options** = **Launch type**, **Launch type** = **Fargate**, **Platform version** = **LATEST**.
4. **Deployment configuration:** **Scheduling strategy:** **Replica**; **Desired tasks:** `1`. Leave AZ rebalancing and health check grace period at defaults.
5. **Networking** (expand): default VPC and subnets. **Security group:** **Use an existing security group** → **`orders-sg`**. **Public IP:** **Turned on**.
   > The wizard attaches **this same `orders-sg`** to the ALB it creates below — so
   > `orders-sg` ends up on both the ALB and the orders task. That's why `orders-sg`
   > has both the `80`-from-internet and the `8080`-from-self inbound rules
   > (Step 05 G2).
6. **Service Connect** (expand): tick **Use Service Connect**. **Service Connect configuration:** **Client side only**. **Namespace:** select `microsvc.local`. (Client-side mode has no Port alias / DNS card — orders only *calls* inventory, it isn't discovered by name.)
7. **Load balancing** (expand): tick **Use load balancing**.
   - **VPC:** leave the prefilled value (it matches the service VPC).
   - **Load balancer type:** **Application Load Balancer**.
   - **Container:** select **`orders 8080:8080`** (the orders container's port).
   - **Application Load Balancer:** **Create a new load balancer**.
   - **Load balancer name:** `orders-alb`.
   - **Listener:** **Create new listener** — **Port** `80`, **Protocol** **HTTP**.
   - **Target group:** **Create new target group** —
     - **Target group name:** `orders-tg`.
     - **Protocol:** **HTTP**.
     - **Port:** `80`.
     - **Deregistration delay:** leave default (`300`).
     - **Health check protocol:** **HTTP**.
     - **Health check path:** `/health` (default is `/` — change it).
   - The wizard attaches **`orders-sg`** (your service SG from step 5) to this ALB — no separate ALB security group. That's why `orders-sg` carries the `80`-from-internet rule.
8. Leave the remaining optional sections at defaults → **Create**.

> **The services won't run yet — that's expected.** The ECR repos are still
> empty (the pipeline pushes images in [Step 07](07-write-the-pipeline.md)), so
> each task tries to pull `:latest`, fails with `CannotPullContainerError`, and
> ECS keeps retrying. **Running count stays 0.** You verify the services are
> healthy in [Step 08](08-deploy-and-verify.md), *after* the first deploy pushes
> a real image. Don't wait for green here.

---

## C. Verify the wiring and note the ALB DNS

This is config, not runtime — do it now even though the tasks aren't running:

- **EC2 → Load Balancers → `orders-alb` → Security:** confirm the attached group is **`orders-sg`** (the wizard should have attached it). If a different group is attached, **Edit security groups** and set it to `orders-sg`.
- **EC2 → Security Groups → `orders-sg` → Inbound:** confirm both rules are present — **80 from `0.0.0.0/0`** and **8080 from `orders-sg` (self)**. The self-8080 rule is what lets the ALB health-check and forward to the orders task; without it the target group stays `Target.Timeout` and ECS loops replacing the task.
- **`orders-sg` → Outbound:** confirm it's still the default **All traffic → `0.0.0.0/0`**. Restricted egress breaks the ALB health check *and* the orders→inventory call.
- **EC2 → Load Balancers → `orders-alb` → DNS name:** copy it (e.g. `orders-alb-123456.eu-west-1.elb.amazonaws.com`) — you'll curl it in [Step 08](08-deploy-and-verify.md).

---

## Checklist

- [ ] (A) `inventory-service` created with Service Connect (Client and server), no ALB, using `inventory-sg`
- [ ] (B) `orders-service` created behind an ALB, using `orders-sg`
- [ ] (C) `orders-sg` is attached to `orders-alb`, with inbound 80 from internet + 8080 from self, and default allow-all egress
- [ ] (C) ALB DNS name noted for Step 08
- [ ] Both services exist in the cluster (running count **0** until Step 07/08 — expected)

## Next

→ [Step 07 — Write the deploy pipeline](07-write-the-pipeline.md)
