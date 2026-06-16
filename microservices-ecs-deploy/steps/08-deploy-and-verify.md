# Step 08 — Deploy & verify end-to-end

**Goal:** trigger the pipeline, confirm both services actually deployed, and
prove the cross-service dependency through the real ALB — not just a green
pipeline.

---

## A. Trigger and watch

```bash
git push origin main
gh run watch
```

Both matrix jobs (`inventory` and `orders`) must go **green independently**.
Because `fail-fast: false`, one failing does not cancel the other.

---

## B. Confirm the real deployment

This first deploy is what finally lets the services run: until now the ECR repos
were empty, so both services sat at **running count 0** with
`CannotPullContainerError` (Step 06). The pipeline just pushed a real image and
rolled each service to it — so now they should actually come up.

A green pipeline is necessary but not sufficient — check the running services:

```bash
aws ecs describe-services --cluster <cluster-name> \
  --services inventory-service orders-service \
  --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount}'
```

Every service should now report `running == desired`. In **EC2 → Target Groups →
`orders-tg`**, the orders task should also show **healthy** (the ALB's `/health`
check passes).

Now hit the public ALB (only `orders` is exposed; `inventory` is internal):

```bash
curl -sX POST "http://<alb-dns-name>/orders" -H 'content-type: application/json' \
     -d '{"sku":"widget","quantity":2}'   # expect "confirmed"
curl -sX POST "http://<alb-dns-name>/orders" -H 'content-type: application/json' \
     -d '{"sku":"gadget","quantity":2}'   # expect "backordered"
```

This is the same contract you proved locally in [Step 03](03-compose-local.md),
now flowing: ALB → `orders` → Service Connect → `inventory`.

---

## C. Bonus — Prove the dependency in production

Scale inventory to zero and re-test; orders should fail loudly:

```bash
aws ecs update-service --cluster <cluster-name> --service inventory-service --desired-count 0

curl -sX POST "http://<alb-dns-name>/orders" -H 'content-type: application/json' \
     -d '{"sku":"widget","quantity":2}'   # expect 503 inventory service unavailable

aws ecs update-service --cluster <cluster-name> --service inventory-service --desired-count 1
```

If this doesn't return `503`, `orders-service` is catching and swallowing the
connection error instead of surfacing it.

---

## Troubleshooting

In order of likelihood if the deploy fails:

1. Missing `permissions: id-token: write` on the workflow or job
2. OIDC trust policy `sub` condition doesn't match
   `repo:ORG/REPO:ref:refs/heads/main` for your actual repo
3. `container-name` in the render step doesn't match the container name
   inside `task-definition.json`
4. `AWS_DEPLOY_ROLE_ARN` was stored as a *secret* instead of a *variable*
   (`vars.AWS_DEPLOY_ROLE_ARN` resolves empty)
5. `AWS_DEPLOY_ROLE_ARN` holds the **provider** ARN (`:oidc-provider/...`)
   instead of the **role** ARN (`:role/...`) — the deploy step logs
   **"Assuming role with OIDC"** repeatedly then fails. Check the variable value
   contains `:role/`; fix it per [Step 04](04-github-repo.md) B.2 step 7
6. Tasks fail with
   `AccessDeniedException ... not authorized to perform: logs:CreateLogGroup` —
   `ecsTaskExecutionRole` is missing the `allow-create-log-group` inline policy
   (Step 05 B step 6). The managed policy alone can't create a log group.

**Most failures below come from restricted SG *egress*.** Fargate relies on
**outbound** for almost everything; if `orders-sg`/`inventory-sg` don't keep the
default allow-all egress (Step 05 G2), you hit these in turn:

7. Tasks never start; events show
   `ResourceInitializationError: ... cannot pull registry auth from Amazon ECR ...
   i/o timeout` — task SG has **no outbound 443** (or no public IP). Restore
   default egress (or add **443 → `0.0.0.0/0`**) and confirm `assignPublicIp: ENABLED`.
8. Tasks start but the orders target is stuck **`Target.Timeout`** (ALB returns
   504, ECS keeps replacing the task) — `orders-sg` egress doesn't allow the ALB
   to reach the task. Since the ALB *and* the task share `orders-sg`, egress must
   permit **8080 to `orders-sg` itself**. Default allow-all egress covers this; a
   locked-down egress does not.
9. `/orders` returns `{"error":"inventory service unavailable"}` — orders can't
   reach inventory. Check: `orders-sg` **egress** allows **8080 to `inventory-sg`**
   (default allow-all covers it), `inventory-sg` **inbound** allows 8080 from
   `orders-sg`, inventory Service Connect is **server mode** advertising DNS
   `inventory`, and `INVENTORY_URL` = `http://inventory.microsvc.local:8080`.

---

## What you learned

- A green pipeline is not proof of a working system — you verify the running
  services and the real cross-service call through the ALB. You containerized
  two services, ran them together locally, and shipped them to ECS through a
  keyless OIDC pipeline.

## Checklist

- [ ] A push to `main` ran your workflow; both matrix jobs went green independently
- [ ] `aws ecs describe-services` shows both services with `running == desired`
- [ ] The ALB returns `confirmed` / `backordered` correctly
- [ ] (Bonus) Scaling inventory to zero makes `/orders` return `503`

---

That's the whole lab. 🎉
