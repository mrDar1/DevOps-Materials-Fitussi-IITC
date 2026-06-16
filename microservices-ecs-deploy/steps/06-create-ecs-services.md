# Step 06 — Create the ECS services

**Goal:** create the two ECS services in `microsvc-cluster`, wiring together the
task definitions, Service Connect namespace, security groups, and load balancer
you built in [Step 05](05-provision-aws-infra.md).

Create **`inventory-service` first** (orders depends on it).

---

## A. `inventory-service` (internal — no load balancer)

1. **ECS → Clusters → `microsvc-cluster` → Services tab → Create**.
2. **Compute configuration:** **Launch type** → **FARGATE**, **Platform version** **LATEST**.
3. **Deployment configuration:**
   - **Application type:** **Service**.
   - **Task definition → Family:** `inventory-service`; **Revision:** `1 (LATEST)`.
   - **Service name:** `inventory-service`.
   - **Desired tasks:** `1`.
4. **Networking:**
   - **VPC:** default VPC.
   - **Subnets:** leave all default public subnets selected.
   - **Security group:** **Use an existing security group** → **`inventory-sg`** (no other group selected).
   - **Public IP:** **Turned on**.
5. **Service Connect:** tick **Use Service Connect**.
   - **Namespace:** `microsvc.local`.
   - **Mode:** **Client and server**.
   - **Port mapping:** tick the `inventory` port (container port **8080**), set **Port alias / DNS:** `inventory`, **Port:** `8080`.
6. **Load balancing:** leave **None** → **Create**.

---

## B. `orders-service` (public — behind an Application Load Balancer)

1. **Clusters → `microsvc-cluster` → Services tab → Create**.
2. **Compute configuration:** **Launch type** → **FARGATE**, **Platform version** **LATEST**.
3. **Deployment configuration:**
   - **Application type:** **Service**.
   - **Task definition → Family:** `orders-service`; **Revision:** `1 (LATEST)`.
   - **Service name:** `orders-service`.
   - **Desired tasks:** `1`.
4. **Networking:** default VPC and subnets. **Security group:** **Use an existing security group** → **`orders-sg`**. **Public IP:** **Turned on**.
5. **Load balancing:**
   - **Load balancer type:** **Application Load Balancer**.
   - **Create a new load balancer**.
   - **Load balancer name:** `orders-alb`.
   - **Security group:** select **`alb-sg`** if the wizard allows; otherwise verify it in Section C.
   - **Health check grace period:** default.
   - **Listener:** **Create new listener** — **Port** `80`, **Protocol** **HTTP**.
   - **Target group:** **Create new target group** — **Name** `orders-tg`, **Protocol** **HTTP**, **Health check path** `/health`.
6. **Service Connect:** tick **Use Service Connect**, **Namespace:** `microsvc.local`, **Mode:** **Client side only**.
7. Click **Create**.

---

## C. Confirm it's healthy

- **EC2 → Load Balancers → `orders-alb` → Security:** confirm the attached group is `alb-sg`, or that its group allows **inbound HTTP port 80 from `0.0.0.0/0`**.
- **ECS → `microsvc-cluster` → Services:** both services reach **running count = desired count (1)**.
- **EC2 → Target Groups:** the orders target group lists its task as **healthy**.
- **EC2 → Load Balancers → `orders-alb` → DNS name:** copy it (e.g. `orders-alb-123456.eu-west-1.elb.amazonaws.com`) for Step 08.

---

## Checklist

- [ ] (A) `inventory-service` runs with Service Connect, no ALB, using `inventory-sg`
- [ ] (B) `orders-service` runs behind an ALB, using `orders-sg`
- [ ] (C) ALB security group allows HTTP 80 from `0.0.0.0/0`
- [ ] (C) Both services show running == desired; orders target group is **healthy**
- [ ] (C) ALB DNS name noted for Step 08

## Next

→ [Step 07 — Write the deploy pipeline](07-write-the-pipeline.md)
