# Lab 9 — GitHub Actions → Docker Hub → ALB + ASG

**No SSH. No AWS Access Keys. No port 22.**

---

## Architecture

```
git push → GitHub Actions
               │
               ├─ [Lint + Type check + Tests (MongoDB service container)]
               │
               ├─ [docker push] ──────────→ Docker Hub (private repo)
               │
               └─ [OIDC → AWS]
                      │
                      ├─ Sync MONGODB_URI → SSM Parameter Store
                      │
                      └─ SSM SendCommand → ASG instances
                                │
                                ▼
                    EC2 reads creds from SSM Parameter Store
                    docker pull + docker run (with MONGODB_URI)
                                │
                         Application Load Balancer
                                │
                    http://<alb-dns-name>  ← public DNS name
```

## Application

The `express-api/` folder is a production-grade Node.js API:

```
express-api/
├── src/
│   ├── app.ts                  Express app (middleware, routes)
│   ├── server.ts               Entry point (connects DB, starts server)
│   ├── config/env.ts           Environment variable config
│   ├── db/connect.ts           Mongoose connection helper
│   ├── models/item.model.ts    Item schema (name, description, timestamps)
│   ├── routes/
│   │   ├── index.ts            Route aggregator
│   │   ├── health.ts           GET /, /health, /version
│   │   └── items.ts            Full CRUD: GET/POST /items, GET/PUT/DELETE /items/:id
│   └── middleware/
│       └── errorHandler.ts     Maps Mongoose errors to HTTP status codes
├── tests/
│   ├── setup.ts                Connects to test MongoDB before suite
│   ├── health.test.ts          Tests for /, /health, /version
│   └── items.test.ts           Tests for CRUD operations
├── Dockerfile                  Multi-stage: compile TS → minimal runtime image
├── tsconfig.json               NodeNext module resolution
└── vitest.config.ts            Test runner config
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | `{ message: 'Hello from student-api!' }` |
| `/health` | GET | `{ status, db, uptime }` — 503 if DB is down |
| `/version` | GET | `{ version, commit }` — shows deployed SHA |
| `/items` | GET | List all items (newest first) |
| `/items` | POST | Create item `{ name, description? }` |
| `/items/:id` | GET | Get item by MongoDB ObjectId |
| `/items/:id` | PUT | Update item |
| `/items/:id` | DELETE | Delete item (204 on success) |

**Copy `express-api/` into your repo before starting.**

---

## Concepts Covered

| Concept | What you learn |
|---------|----------------|
| GitHub Actions multi-job pipelines | `needs`, `outputs`, job dependencies |
| Service containers | Running MongoDB alongside CI test jobs |
| Docker Hub | Private registry, access tokens, push/pull |
| AWS OIDC | Passwordless AWS auth from GitHub Actions |
| IAM Trust Policies | Scoping which repo can assume which role |
| SSM Parameter Store | GitOps-style secret sync: GitHub → AWS → EC2 |
| AWS Systems Manager | Remote command execution without SSH |
| EC2 Launch Templates | Auto-bootstrap Docker + AWS CLI on every new instance |
| Auto Scaling Groups | ELB health check type, self-healing |
| Application Load Balancer | Internet-facing, provides DNS name |
| TypeScript + Mongoose | Production API patterns |

---

## Required GitHub Secrets

| Secret | Where to get it |
|--------|----------------|
| `AWS_ROLE_ARN` | Output of Task 9 (OIDC role ARN) |
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub → Account Settings → Security |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `ASG_NAME` | Name you give the ASG in Task 8 |
| `ALB_DNS_NAME` | DNS name from the ALB in Task 7 |

---

## Part A — Docker Hub Setup

### Task 1 — Create a Docker Hub repository

1. Sign in at [hub.docker.com](https://hub.docker.com).
2. **Create Repository** → Name: `student-api` → Visibility: **Private** → Create.

Your image name will be: `<your-username>/student-api`

### Task 2 — Create a Docker Hub access token

1. Docker Hub → avatar → **Account Settings** → **Security** → **New Access Token**.
2. Description: `student-api-deploy`, Permissions: **Read, Write, Delete**.
3. Copy the token.

Add both as GitHub secrets: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.

---

## Part B — MongoDB Atlas

### Task 3 — Create a free MongoDB Atlas cluster

1. Sign in at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a **free (M0) cluster** — any region, any provider.
3. **Database Access** → Add a database user (username + password).
4. **Network Access** → Add IP Address → **0.0.0.0/0** (allow anywhere — EC2 IPs are dynamic).
5. **Clusters** → **Connect** → **Drivers** → Copy the connection string:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/student-api?retryWrites=true&w=majority
   ```

Add it as GitHub secret `MONGODB_URI`.

> **How this flows at deploy time:**  
> 1. The deploy workflow syncs `MONGODB_URI` to AWS SSM Parameter Store (encrypted).  
> 2. Each EC2 instance reads it from SSM Parameter Store at deploy time using its IAM role.  
> 3. The Docker container receives it as an environment variable.  
> No MongoDB credentials are baked into your Docker image or EC2 instance.

---

## Part C — AWS Infrastructure

### Task 4 — Security Groups

Create two security groups in the same VPC.

**`alb-sg` — for the Application Load Balancer:**

| Rule | Type | Protocol | Port | Source |
|------|------|----------|------|--------|
| Inbound | HTTP | TCP | 80 | 0.0.0.0/0 |
| Outbound | All traffic | All | All | 0.0.0.0/0 |

**`ec2-sg` — for EC2 instances:**

| Rule | Type | Protocol | Port | Source |
|------|------|----------|------|--------|
| Inbound | Custom TCP | TCP | 3000 | `alb-sg` (security group ID) |
| Outbound | All traffic | All | All | 0.0.0.0/0 |

> No port 22. No port 80 on EC2. Port 3000 is only reachable from the ALB. The outbound `All traffic` rule allows the SSM Agent to call AWS endpoints and Docker to pull from Docker Hub and connect to Atlas.

### Task 5 — EC2 IAM Role

Create an IAM role for EC2 instances.

- Trusted entity: **AWS service → EC2**
- Role name: `student-api-ec2-role`

**Attached managed policy:**
- `AmazonSSMManagedInstanceCore`

**Inline policy** (name: `StudentApiParameterStoreRead`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters"],
      "Resource": "arn:aws:ssm:*:*:parameter/student-api/*"
    }
  ]
}
```

This grants access to ALL three secrets (`dockerhub/username`, `dockerhub/token`, `mongodb/uri`) with a single rule.

### Task 6 — Store Docker Hub credentials in SSM Parameter Store

> **Note:** The MongoDB URI is synced automatically by the deploy pipeline. You only need to put the Docker Hub credentials manually once.

```bash
aws ssm put-parameter \
  --name /student-api/dockerhub/username \
  --value "<your-dockerhub-username>" \
  --type String \
  --region us-east-1

aws ssm put-parameter \
  --name /student-api/dockerhub/token \
  --value "<your-dockerhub-token>" \
  --type SecureString \
  --region us-east-1
```

The pipeline will create `/student-api/mongodb/uri` automatically on first deploy.

### Task 7 — Launch Template

- Name: `student-api-lt`
- AMI: **Ubuntu Server 22.04 LTS** (64-bit x86)
- Instance type: `t3.micro`
- IAM instance profile: `student-api-ec2-role`
- Security groups: `ec2-sg`
- Key pair: **None** (no SSH)

**User Data:**

```bash
#!/bin/bash
set -e

apt-get update -y
apt-get install -y docker.io unzip curl jq

systemctl start docker
systemctl enable docker

# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
  -o "/tmp/awscliv2.zip"
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/aws /tmp/awscliv2.zip
```

### Task 8 — Target Group

- Type: **Instances**
- Name: `student-api-tg`
- Protocol: **HTTP**, Port: **3000**
- Health check path: `/health`
- Health check interval: 30 seconds
- Healthy threshold: 2

### Task 9 — Application Load Balancer

- Name: `student-api-alb`
- Scheme: **Internet-facing**
- Subnets: at least 2 public subnets in different AZs
- Security groups: `alb-sg`
- Listener: HTTP :80 → forward to `student-api-tg`

Copy the **DNS name** and add it as GitHub secret `ALB_DNS_NAME`.

### Task 10 — Auto Scaling Group

- Name: `student-api-asg`
- Launch template: `student-api-lt`
- Subnets: same as ALB (at least 2 AZs)
- Load balancing: attach to `student-api-tg`
- Health check type: **ELB**
- Health check grace period: 120 seconds
- Desired: 1, Minimum: 1, Maximum: 2

---

## Part D — GitHub OIDC

### Task 11 — OIDC Provider and IAM Role

**Step 1 — Add GitHub OIDC identity provider:**

IAM → Identity providers → Add provider
- Type: **OpenID Connect**
- URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

**Step 2 — Create IAM role:**

- Trusted entity: **Web identity** → `token.actions.githubusercontent.com`
- Role name: `student-api-github-actions-role`

**Step 3 — Edit trust policy** (restrict to your repo):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<GITHUB_ORG>/<REPO>:*"
        }
      }
    }
  ]
}
```

**Step 4 — Attach inline permissions policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SSMDeploy",
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SSMConfig",
      "Effect": "Allow",
      "Action": "ssm:PutParameter",
      "Resource": "arn:aws:ssm:*:*:parameter/student-api/*"
    },
    {
      "Sid": "ASGDescribe",
      "Effect": "Allow",
      "Action": "autoscaling:DescribeAutoScalingGroups",
      "Resource": "*"
    }
  ]
}
```

> `SSMConfig` allows the deploy pipeline to sync secrets (`MONGODB_URI`) from GitHub to SSM Parameter Store on every deployment — GitOps for secrets.

**Step 5 — Copy the Role ARN** and add as GitHub secret `AWS_ROLE_ARN`.

---

## Part E — Local Development

### Task 12 — Run the API locally

```bash
cd express-api
npm install

# Requires a running MongoDB (local or Atlas)
export MONGODB_URI="mongodb://localhost:27017/student-api-dev"
npm run dev
```

Test endpoints:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/items
curl -X POST http://localhost:3000/items \
  -H "Content-Type: application/json" \
  -d '{"name":"my first item","description":"testing"}'
curl http://localhost:3000/items
```

Run tests (tests use a `MONGODB_URI` provided via env):
```bash
# Needs a MongoDB — you can spin one up with Docker:
docker run -d --name test-mongo -p 27017:27017 mongo:7

MONGODB_URI="mongodb://localhost:27017/test" npm test
```

---

## Part F — CI Pipeline

### Task 13 — Create `.github/workflows/ci.yml`

The CI pipeline runs on every push and pull request with three jobs:

**`lint`** — ESLint + TypeScript type check  
**`test`** — spins up a MongoDB 7 service container, runs `npm test`  
**`build`** — Docker build without push (verifies Dockerfile)

The test job uses a GitHub Actions **service container**:
```yaml
services:
  mongodb:
    image: mongo:7
    ports:
      - 27017:27017
```

Tests connect to `mongodb://localhost:27017/student-api-test` — fully isolated, no Atlas account needed for CI.

See `solution/.github/workflows/ci.yml` for the complete file.

---

## Part G — Push to Docker Hub

### Task 14 — Create `.github/workflows/deploy.yml` — build and push job

The `build-and-push` job:
1. Logs in with `docker/login-action@v3`
2. Builds with `--build-arg COMMIT_SHA=${{ github.sha }}` (embedded in the image)
3. Tags as `<username>/student-api:<sha>` + `<username>/student-api:latest`
4. Pushes both tags; outputs full SHA-tagged URI for the deploy job

---

## Part H — Deploy via SSM

### Task 15 — Complete `deploy.yml` — deploy job

**Secret sync step:** Before sending the SSM command, the pipeline syncs your `MONGODB_URI` GitHub secret to AWS SSM Parameter Store:

```yaml
- name: Sync MongoDB URI to SSM Parameter Store
  run: |
    aws ssm put-parameter \
      --name /student-api/mongodb/uri \
      --value "${{ secrets.MONGODB_URI }}" \
      --type SecureString \
      --overwrite
```

This is **GitOps for secrets** — the deploy pipeline is the source of truth for secrets, keeping GitHub and AWS in sync automatically.

**SSM deploy script** (runs on each EC2 instance via Run Command):

```bash
# Instance reads all credentials from SSM Parameter Store using its IAM role
DH_USER=$(aws ssm get-parameter --name /student-api/dockerhub/username ...)
DH_TOKEN=$(aws ssm get-parameter --name /student-api/dockerhub/token --with-decryption ...)
MONGO_URI=$(aws ssm get-parameter --name /student-api/mongodb/uri --with-decryption ...)

# Authenticate, pull, replace container
echo "$DH_TOKEN" | docker login --username "$DH_USER" --password-stdin
docker pull <image>
docker stop student-api && docker rm student-api
docker run -d --name student-api --restart unless-stopped \
  -p 3000:3000 \
  -e COMMIT_SHA=<sha> \
  -e MONGODB_URI="$MONGO_URI" \
  <image>
```

**Trigger a full pipeline run:**

Push a commit to `main`. Watch all jobs run:

```
lint → test → build-and-push → deploy
```

Once you see:
```
Healthy at: http://<your-alb-dns>
```

Test it end-to-end:
```bash
curl http://<ALB_DNS_NAME>/health
# {"status":"ok","db":"connected","uptime":42}

curl -X POST http://<ALB_DNS_NAME>/items \
  -H "Content-Type: application/json" \
  -d '{"name":"deployed item","description":"created via ALB"}'

curl http://<ALB_DNS_NAME>/version
# {"version":"1.0","commit":"<your-git-sha>"}
```

---

## Verification Checklist

- [ ] Docker Hub shows `<username>/student-api` with `:<sha>` and `:latest` tags
- [ ] ALB DNS responds on port 80 (not 3000)
- [ ] `GET /health` returns `{"status":"ok","db":"connected",...}`
- [ ] `GET /version` shows the commit SHA matching the latest GitHub push
- [ ] Items persist across requests (MongoDB is connected)
- [ ] CI `test` job passes (green service container tests)
- [ ] No port 22 in `ec2-sg` inbound rules
- [ ] No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in GitHub secrets
- [ ] `GET /health` returns 503 if you disconnect from Atlas temporarily

---

## Bonus Tasks

### Bonus 1 — Rolling deploy with zero downtime

The current deploy sends the SSM command to all instances simultaneously, causing a brief period where containers are restarting. To get true rolling deployment:

1. Scale the ASG to desired=2
2. Modify the deploy job to update instances one at a time:
   - Get instance IDs from ASG
   - For each instance: deregister from target group → wait → deploy → re-register → wait for healthy → move to next
3. The ALB routes only to healthy, registered instances throughout

What AWS permissions does this require? Which deregister/register API calls do you need?

### Bonus 2 — Health check shows MongoDB details

Update `GET /health` to return more diagnostics:

```json
{
  "status": "ok",
  "db": "connected",
  "dbName": "student-api",
  "uptime": 142,
  "items": 5
}
```

The `items` count requires a Mongoose query inside the health handler. Consider the performance implications — would you do this in a real production system?

### Bonus 3 — Slack notification on deploy

```yaml
- name: Notify Slack
  if: success()
  run: |
    curl -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" \
      -H 'Content-type: application/json' \
      --data "{\"text\":\"Deployed \`${{ github.sha }}\` to http://${{ secrets.ALB_DNS_NAME }} :rocket:\"}"
```

### Bonus 4 — Self-healing: new ASG instances bootstrap themselves

Extend the Launch Template User Data so a replacement instance (launched after a health check failure) starts the application without a pipeline run:

```bash
# After installing Docker + AWS CLI, add:
REGION="us-east-1"
DH_USER=$(aws ssm get-parameter --region "$REGION" \
  --name /student-api/dockerhub/username --query Parameter.Value --output text)
DH_TOKEN=$(aws ssm get-parameter --region "$REGION" \
  --name /student-api/dockerhub/token --with-decryption --query Parameter.Value --output text)
MONGO_URI=$(aws ssm get-parameter --region "$REGION" \
  --name /student-api/mongodb/uri --with-decryption --query Parameter.Value --output text)

echo "$DH_TOKEN" | docker login --username "$DH_USER" --password-stdin

docker run -d --name student-api \
  --restart unless-stopped \
  -p 3000:3000 \
  -e MONGODB_URI="$MONGO_URI" \
  "$DH_USER/student-api:latest"
```

> When the ASG launches a replacement instance, this User Data script fetches all credentials from SSM Parameter Store and starts the last-pushed image automatically — production state is restored without any human intervention.

---

## Secret flow summary

```
GitHub Secrets (CI machine)              AWS SSM Parameter Store (runtime)
──────────────────────────               ─────────────────────────────────
DOCKERHUB_USERNAME  ─► push image        /student-api/dockerhub/username  ─┐
DOCKERHUB_TOKEN     ─► push image        /student-api/dockerhub/token     ─┤─► EC2 reads at deploy
AWS_ROLE_ARN        ─► OIDC auth         /student-api/mongodb/uri         ─┘
MONGODB_URI         ─► synced to SSM ──►   (synced by deploy pipeline)
ASG_NAME            ─► SSM target
ALB_DNS_NAME        ─► health check

No AWS keys in GitHub. No credentials in EC2 User Data. No SSH. No port 22.
```
