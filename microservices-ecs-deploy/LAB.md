# Lab — Microservices to ECS/ECR via GitHub Actions (OIDC)

**No SSH. No AWS Access Keys.**

---

## Architecture

```
git push → GitHub Actions (matrix: inventory, orders)
               │
               ├─ [OIDC → AWS, no stored keys]
               │
               ├─ [docker build + push] ──────→ Amazon ECR (one repo per service)
               │
               └─ [render + deploy task def] ──→ Amazon ECS Fargate
                                                       │
                                          inventory-service   orders-service
                                          (no public access)  (behind the ALB)
                                                   ▲                  │
                                                   └── Service Connect ┘
                                                       inventory.microsvc.local:8080
                                                                       │
                                                       Application Load Balancer
                                                                       │
                                                       http://<alb-dns-name>/orders
```

`orders-service` cannot answer a request without calling `inventory-service`
over `INVENTORY_URL`. That's the dependency you're proving end-to-end once
this is deployed.

---

## Application

```
inventory-service/
├── app.py                  GET /health, GET /stock/<sku>
├── requirements.txt
├── Dockerfile
├── task-definition.json    ECS Fargate task definition (execution role ARN templated)
└── tests/test_app.py

orders-service/
├── app.py                  GET /health, POST /orders → calls inventory over HTTP
├── requirements.txt
├── Dockerfile
├── task-definition.json
└── tests/test_app.py
```

| Service | Endpoint | Description |
|---|---|---|
| inventory | `GET /health` | `{"status": "ok"}` |
| inventory | `GET /stock/<sku>` | `{"sku": ..., "quantity": ...}` — `0` for unknown SKUs |
| orders | `GET /health` | `{"status": "ok"}` |
| orders | `POST /orders` `{"sku": ..., "quantity": ...}` | Calls inventory, returns `"confirmed"` / `"backordered"`, or `503` if inventory is unreachable |

**Create a new standalone GitHub repo for this lab.** Copy the contents of
this folder (not the folder itself, and not `solution/`) into the root of
that repo — `inventory-service/`, `orders-service/`, and `docker-compose.yml`
should sit at the repo root.

```bash
gh repo create <your-username>/microservices-ecs-deploy --private --clone
cd microservices-ecs-deploy
cp -r /path/to/this/lab/{inventory-service,orders-service,docker-compose.yml} .
git add . && git commit -m "feat: initial microservices-ecs-deploy" && git push
```

---

## Concepts Covered

| Concept | What you learn |
|---|---|
| GitHub OIDC | Passwordless AWS auth from GitHub Actions — no stored access keys |
| IAM trust policies | Scoping which repo + branch can assume which role |
| Amazon ECR | Per-service container registries, commit-SHA image tags |
| Amazon ECS Fargate | Serverless container orchestration |
| ECS Service Connect | Service-to-service discovery via a private Cloud Map DNS namespace |
| Render + deploy task definitions | Declarative, idempotent ECS deploys from a JSON template |
| GitHub Actions matrix | Two services deployed independently in the same workflow |
| Application Load Balancer | Only the public-facing service is exposed; the internal one isn't |

---

## Required GitHub configuration

OIDC means **no secret access keys**. Your instructor provisions the AWS
infrastructure and gives you these values. Store the role ARN as a repo
**variable** (it is not a secret):

| Name | Kind | Where it comes from |
|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | Repo variable | IAM role ARN your instructor created for OIDC deploys |
| AWS region | Used in your workflow's `env:` | e.g. `eu-west-1` |
| ECS cluster name | Used in your workflow's `env:` | e.g. `microsvc-cluster` |
| ECR repo names | Used to build the image URI | `inventory-service`, `orders-service` |

```bash
gh variable set AWS_DEPLOY_ROLE_ARN -b "<role-arn-from-instructor>"
```

---

## Part A — Local Development

Confirm both services work together before touching AWS:

```bash
(cd inventory-service && pip install -r requirements.txt && pytest -q)
(cd orders-service   && pip install -r requirements.txt && pytest -q)

docker compose up --build -d
curl -sX POST localhost:8080/orders -H 'content-type: application/json' \
     -d '{"sku":"widget","quantity":2}'    # expect status "confirmed"
curl -sX POST localhost:8080/orders -H 'content-type: application/json' \
     -d '{"sku":"gadget","quantity":2}'    # expect status "backordered"
docker compose down
```

If these don't behave as described, fix it before touching AWS — everything
downstream assumes this contract holds.

---

## Part B — Write `.github/workflows/deploy.yml` yourself

This is the core exercise. No starter workflow is provided — write it to
satisfy these requirements:

- [ ] Triggers on push to `main`
- [ ] `permissions: id-token: write` and `contents: read` (required for OIDC)
- [ ] A `strategy.matrix` that treats `inventory` and `orders` as independent
      deploy targets in the same job — one service failing must not block the
      other (`fail-fast: false`)
- [ ] Assumes `vars.AWS_DEPLOY_ROLE_ARN` via
      `aws-actions/configure-aws-credentials` — no `aws-access-key-id` input
      anywhere
- [ ] Logs in to ECR with `aws-actions/amazon-ecr-login`
- [ ] Builds each service's image from its own folder, tags it with
      `${{ github.sha }}`, and pushes it to the matching ECR repo
- [ ] Renders each service's `task-definition.json` with the new image using
      `aws-actions/amazon-ecs-render-task-definition`, matching the right
      container name
- [ ] Deploys the rendered task definition to the matching ECS service with
      `aws-actions/amazon-ecs-deploy-task-definition`, with
      `wait-for-service-stability: true`

Pin all actions to a major version tag (e.g. `@v4`), not `@main` or a full SHA.

---

## Part C — Verify end-to-end

```bash
git push origin main
gh run watch
```

Both matrix jobs must go green. Then confirm the real deployment, not just
the pipeline:

```bash
aws ecs describe-services --cluster <cluster-name> \
  --services inventory-service orders-service \
  --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount}'

curl -sX POST "http://<alb-dns-name>/orders" -H 'content-type: application/json' \
     -d '{"sku":"widget","quantity":2}'   # expect "confirmed"
curl -sX POST "http://<alb-dns-name>/orders" -H 'content-type: application/json' \
     -d '{"sku":"gadget","quantity":2}'   # expect "backordered"
```

---

## Verification Checklist

- [ ] Both service test suites pass locally
- [ ] `docker compose up` proves the cross-service call works locally
- [ ] No AWS access keys exist as GitHub secrets — OIDC only
- [ ] A push to `main` runs your workflow; both matrix jobs go green independently
- [ ] `aws ecs describe-services` shows both services with `running == desired`
- [ ] The ALB returns `confirmed` / `backordered` correctly through the real deployment

---

## Bonus — Prove the dependency in production

Scale inventory to zero and re-test:

```bash
aws ecs update-service --cluster <cluster-name> --service inventory-service --desired-count 0
curl -sX POST "http://<alb-dns-name>/orders" -H 'content-type: application/json' \
     -d '{"sku":"widget","quantity":2}'   # expect 503 inventory service unavailable
aws ecs update-service --cluster <cluster-name> --service inventory-service --desired-count 1
```

If this doesn't return `503`, check whether `orders-service` is catching and
swallowing the connection error instead of surfacing it.

---

## Troubleshooting

In order of likelihood if the deploy fails:

1. Missing `permissions: id-token: write` on the workflow or job
2. OIDC trust policy `sub` condition doesn't match
   `repo:ORG/REPO:ref:refs/heads/main` for your actual repo
3. `container-name` in the render step doesn't match the container name
   inside `task-definition.json`
4. `orders` can't reach `inventory` — check the security group allows port
   `8080` from itself, and that `INVENTORY_URL` points at
   `http://inventory.microsvc.local:8080`
