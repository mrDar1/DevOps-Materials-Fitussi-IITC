# Step 07 — Deploy & verify end-to-end

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

A green pipeline is necessary but not sufficient — check the running services:

```bash
aws ecs describe-services --cluster <cluster-name> \
  --services inventory-service orders-service \
  --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount}'
```

Every service should report `running == desired`.

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
5. `orders` can't reach `inventory` — check the security group allows port
   `8080` from itself, and that `INVENTORY_URL` points at
   `http://inventory.microsvc.local:8080`

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
