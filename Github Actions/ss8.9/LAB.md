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

**Create a new standalone GitHub repo for this lab.** Copy the contents of `express-api/` (not the folder itself) into the root of that repo. The workflows treat the repo root as the working directory — all source files, `package.json`, and `Dockerfile` live at root level, not inside a subdirectory.

```bash
# Create the repo and push the app code
gh repo create <your-username>/student-api --private --clone
cd student-api
cp -r /path/to/express-api/. .
mkdir -p .github/workflows
cp /path/to/solution/.github/workflows/ci.yml .github/workflows/
cp /path/to/solution/.github/workflows/deploy.yml .github/workflows/
git add . && git commit -m "feat: initial student-api" && git push
```

---

## Concepts Covered

| Concept | What you learn |
|---------|----------------|
| GitHub Actions multi-job pipelines | `needs`, job dependencies |
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
| `AWS_ROLE_ARN` | Output of Task 11 (OIDC role ARN) |
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub → Account Settings → Security |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `ASG_NAME` | Name you give the ASG in Task 10 |
| `ALB_DNS_NAME` | DNS name from the ALB in Task 9 |

---

## Part A — Docker Hub Setup

### Task 1 — Create a Docker Hub repository

1. Sign in at [hub.docker.com](https://hub.docker.com).
2. **Create Repository** → Name: `student-api` → Visibility: **Private** → Create.

Your image name will be: `<your-username>/student-api`

### Task 2 — Create a Docker Hub access token

1. Docker Hub → avatar → **Account Settings** → **Personal access tokens** → **Generate new token**.
2. Description: `student-api-deploy`, Permissions: **Read, Write, Delete**.
3. Copy the token immediately — it won't be shown again.

Add both as GitHub secrets:

```bash
gh secret set DOCKERHUB_USERNAME --repo <your-username>/student-api
gh secret set DOCKERHUB_TOKEN --repo <your-username>/student-api
```

---

## Part B — MongoDB Atlas

### Task 3 — Create a free MongoDB Atlas cluster

1. Sign in at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a **free (M0) cluster** — any region, any provider.
3. **Database Access** → Add a database user (username + password).
4. **Network Access** → Add IP Address → **0.0.0.0/0** (allow anywhere — EC2 IPs are dynamic).
5. **Clusters** → **Connect** → **Drivers** → Copy the connection string.  
   Make sure the database name `student-api` is in the path:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/student-api?retryWrites=true&w=majority
   ```

Add it as GitHub secret `MONGODB_URI`:

```bash
gh secret set MONGODB_URI --repo <your-username>/student-api
```

> **How this flows at deploy time:**
> 1. The deploy workflow syncs `MONGODB_URI` to AWS SSM Parameter Store (encrypted).
> 2. Each EC2 instance reads it from SSM Parameter Store at deploy time using its IAM role.
> 3. The Docker container receives it as an environment variable.
> No MongoDB credentials are baked into your Docker image or EC2 instance.

---

## Part C — AWS Infrastructure

> All steps below use region **us-east-1**. If you use a different region, switch it in the console region selector (top-right) and in every resource you create.

---

### Task 4 — Security Groups

**Navigate:** AWS Console → **EC2** → left sidebar → **Network & Security** → **Security Groups**

#### Create `alb-sg` (for the Load Balancer)

1. Click **Create security group** (orange button, top right).
2. Fill in:
   - **Security group name:** `alb-sg`
   - **Description:** `ALB security group for student-api`
   - **VPC:** select the **default VPC**
3. Under **Inbound rules** → click **Add rule**:
   - **Type:** `HTTP`
   - **Source:** `Anywhere-IPv4` (`0.0.0.0/0`)
4. Leave **Outbound rules** as-is (default allows all outbound).
5. Click **Create security group**.
6. **Copy the Security group ID** (looks like `sg-xxxxxxxxxxxxxxxxx`) — you need it next.

#### Create `ec2-sg` (for EC2 instances)

1. Click **Create security group** again.
2. Fill in:
   - **Security group name:** `ec2-sg`
   - **Description:** `EC2 security group for student-api`
   - **VPC:** select the **default VPC**
3. Under **Inbound rules** → click **Add rule**:
   - **Type:** `Custom TCP`
   - **Port range:** `3000`
   - **Source:** `Custom` → paste the `alb-sg` security group ID (e.g. `sg-xxxxxxxx`)
4. Leave **Outbound rules** as-is.
5. Click **Create security group**.

> No port 22. No port 80 on EC2. Port 3000 is only reachable from the ALB. The default outbound rule lets SSM Agent reach AWS endpoints and Docker pull from Docker Hub.

---

### Task 5 — EC2 IAM Role

**Navigate:** AWS Console → **IAM** → left sidebar → **Roles** → **Create role**

#### Step 1 — Select trusted entity

- **Trusted entity type:** `AWS service`
- **Service or use case:** `EC2`
- Click **Next**.

#### Step 2 — Add permissions

- Search for `AmazonSSMManagedInstanceCore` → check the box next to it.
- Click **Next**.

#### Step 3 — Name and create

- **Role name:** `student-api-ec2-role`
- Click **Create role**.

#### Step 4 — Add inline policy

1. Find `student-api-ec2-role` in the Roles list → click it.
2. On the **Permissions** tab → click **Add permissions** → **Create inline policy**.
3. Click the **JSON** tab (top of the policy editor).
4. Replace the content with:

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

5. Click **Next**.
6. **Policy name:** `StudentApiParameterStoreRead`
7. Click **Create policy**.

> The console automatically creates the instance profile when you create the role via the console — you do not need to create it separately.

---

### Task 6 — Store Docker Hub credentials in SSM Parameter Store

**Navigate:** AWS Console → **Systems Manager** → left sidebar → **Parameter Store** → **Create parameter**

#### Parameter 1 — Docker Hub username

- **Name:** `/student-api/dockerhub/username`
- **Tier:** `Standard`
- **Type:** `String`
- **Data type:** `text`
- **Value:** your Docker Hub username
- Click **Create parameter**.

#### Parameter 2 — Docker Hub token

- Click **Create parameter** again.
- **Name:** `/student-api/dockerhub/token`
- **Tier:** `Standard`
- **Type:** `SecureString`
- **KMS key source:** `My current account` → `alias/aws/ssm` (default)
- **Value:** your Docker Hub access token
- Click **Create parameter**.

> The pipeline creates `/student-api/mongodb/uri` automatically on first deploy — do not create it manually.

**Verify:** Both parameters now appear in the Parameter Store list with names `/student-api/dockerhub/username` and `/student-api/dockerhub/token`.

---

### Task 7 — Launch Template

**Navigate:** AWS Console → **EC2** → left sidebar → **Instances** → **Launch Templates** → **Create launch template**

#### Template settings

- **Launch template name:** `student-api-lt`
- **Template version description:** `v1`
- Leave **Auto Scaling guidance** checkbox unchecked for now.

#### Application and OS Images (AMI)

- Click **Browse more AMIs**.
- In the search box type `ubuntu 22.04` → press Enter.
- Select the **AWS Marketplace** tab or **Community AMIs**.
- Find **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type** published by **Canonical** (owner: `099720109477`).
- Click **Select**.

#### Instance type

- Select `t3.micro`.

#### Key pair

- **Key pair name:** `Don't include in launch template` (or select "Proceed without a key pair").

#### Network settings

- **Firewall (security groups):** `Select existing security group`
- Select `ec2-sg` from the list.

#### Advanced details (scroll to bottom)

- **IAM instance profile:** select `student-api-ec2-role`.
- **User data:** paste the entire script below into the text area:

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

# Self-heal: pull and run latest image when this instance launches
REGION="us-east-1"
DH_USER=$(aws ssm get-parameter --region "$REGION" \
  --name /student-api/dockerhub/username --query Parameter.Value --output text)
DH_TOKEN=$(aws ssm get-parameter --region "$REGION" \
  --name /student-api/dockerhub/token --with-decryption --query Parameter.Value --output text)
MONGO_URI=$(aws ssm get-parameter --region "$REGION" \
  --name /student-api/mongodb/uri --with-decryption --query Parameter.Value \
  --output text 2>/dev/null || echo "")

echo "$DH_TOKEN" | docker login --username "$DH_USER" --password-stdin

if [ -n "$MONGO_URI" ]; then
  docker run -d --name student-api --restart unless-stopped \
    -p 3000:3000 \
    -e MONGODB_URI="$MONGO_URI" \
    "$DH_USER/student-api:latest" || true
fi
```

- Click **Create launch template**.

> The self-heal block runs at every instance launch. If `/student-api/mongodb/uri` doesn't exist yet (before first deploy), it skips `docker run` gracefully. After the first pipeline push, all future replacement instances start automatically without any human intervention.

---

### Task 8 — Target Group

**Navigate:** AWS Console → **EC2** → left sidebar → **Load Balancing** → **Target groups** → **Create target group**

#### Step 1 — Specify group details

- **Target type:** `Instances`
- **Target group name:** `student-api-tg`
- **Protocol:** `HTTP`
- **Port:** `3000`
- **VPC:** select the **default VPC**
- **Protocol version:** `HTTP1`

**Health checks:**
- **Health check protocol:** `HTTP`
- **Health check path:** `/health`
- Expand **Advanced health check settings**:
  - **Healthy threshold:** `2`
  - **Unhealthy threshold:** `3`
  - **Interval:** `30` seconds

- Click **Next**.

#### Step 2 — Register targets

- Do not add any targets now — the ASG registers instances automatically.
- Click **Create target group**.

---

### Task 9 — Application Load Balancer

**Navigate:** AWS Console → **EC2** → left sidebar → **Load Balancing** → **Load Balancers** → **Create load balancer**

1. Select **Application Load Balancer** → **Create**.

#### Basic configuration

- **Load balancer name:** `student-api-alb`
- **Scheme:** `Internet-facing`
- **IP address type:** `IPv4`

#### Network mapping

- **VPC:** select the **default VPC**
- **Mappings:** check at least **2 Availability Zones** (check all you see for maximum coverage).  
  Each AZ shows a subnet — select the default subnet for each AZ you check.

#### Security groups

- Remove the default security group.
- Select `alb-sg`.

#### Listeners and routing

- Protocol: `HTTP`, Port: `80`
- **Default action:** Forward to → select `student-api-tg`

- Click **Create load balancer**.

2. After creation, click the load balancer name → find the **DNS name** field.  
   It looks like: `student-api-alb-xxxxxxxxxx.us-east-1.elb.amazonaws.com`  
   **Copy this DNS name** — it becomes the `ALB_DNS_NAME` GitHub secret.

```bash
gh secret set ALB_DNS_NAME --repo <your-username>/student-api --body "<paste-dns-name>"
```

---

### Task 10 — Auto Scaling Group

**Navigate:** AWS Console → **EC2** → left sidebar → **Auto Scaling** → **Auto Scaling Groups** → **Create Auto Scaling group**

#### Step 1 — Name and launch template

- **Auto Scaling group name:** `student-api-asg`
- **Launch template:** select `student-api-lt`
- **Version:** `Latest`
- Click **Next**.

#### Step 2 — Instance launch options

- **VPC:** select the **default VPC**
- **Availability Zones and subnets:** select the **same subnets** you used for the ALB (at least 2 AZs)
- Click **Next**.

#### Step 3 — Configure advanced options

- **Load balancing:** `Attach to an existing load balancer`
- **Attach to an existing load balancer:** `Choose from your load balancer target groups`
- Select `student-api-tg | HTTP`
- **Health checks:**
  - Check **Turn on Elastic Load Balancing health checks**
  - **Health check grace period:** `120` seconds
- Click **Next**.

#### Step 4 — Configure group size and scaling

- **Desired capacity:** `1`
- **Minimum capacity:** `1`
- **Maximum capacity:** `2`
- No scaling policies needed for this lab.
- Click **Next**.

#### Steps 5 & 6 — Notifications and Tags

- **Tags:** Add a tag: Key = `Name`, Value = `student-api`, check **Tag new instances**
- Click **Next** → **Create Auto Scaling group**.

```bash
gh secret set ASG_NAME --repo <your-username>/student-api --body "student-api-asg"
```

> **Health check grace period = 120 seconds.** This gives the instance time to install Docker, pull the image, and start the container before ELB health checks can terminate it. The instance will appear **InService** only after `/health` returns 200 twice.

---

## Part D — GitHub OIDC

### Task 11 — OIDC Provider and IAM Role

#### Step 1 — Add the GitHub OIDC identity provider

**Navigate:** AWS Console → **IAM** → left sidebar → **Identity providers** → **Add provider**

- **Provider type:** `OpenID Connect`
- **Provider URL:** `https://token.actions.githubusercontent.com` → click **Get thumbprint**
- **Audience:** `sts.amazonaws.com`
- Click **Add provider**.

> If you already see `token.actions.githubusercontent.com` in the Identity providers list, skip this step — it only needs to exist once per AWS account.

#### Step 2 — Create the IAM role

**Navigate:** IAM → **Roles** → **Create role**

**Trusted entity type:** `Web identity`

- **Identity provider:** `token.actions.githubusercontent.com`
- **Audience:** `sts.amazonaws.com`
- Click **Next**.

**Add permissions:** skip for now (you'll add an inline policy after creation). Click **Next**.

**Role name:** `student-api-github-actions-role` → Click **Create role**.

#### Step 3 — Edit the trust policy to scope it to your repo

1. Click `student-api-github-actions-role` in the Roles list.
2. Click the **Trust relationships** tab → **Edit trust policy**.
3. Replace the entire content with the JSON below.  
   Replace `<ACCOUNT_ID>` with your 12-digit AWS account number (visible in the top-right of the console).  
   Replace `<GITHUB_USERNAME>` with your GitHub username.

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
          "token.actions.githubusercontent.com:sub": "repo:<GITHUB_USERNAME>/student-api:*"
        }
      }
    }
  ]
}
```

4. Click **Update policy**.

#### Step 4 — Add inline permissions policy

1. Still on `student-api-github-actions-role` → **Permissions** tab.
2. Click **Add permissions** → **Create inline policy**.
3. Click the **JSON** tab and paste:

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

5. Click **Next** → **Policy name:** `StudentApiDeployPolicy` → **Create policy**.

#### Step 5 — Copy the Role ARN and add as GitHub secret

1. On the role's summary page, find the **ARN** at the top. It looks like:  
   `arn:aws:iam::123456789012:role/student-api-github-actions-role`
2. Copy it.

```bash
gh secret set AWS_ROLE_ARN --repo <your-username>/student-api --body "<paste-role-arn>"
```

**Verify all 6 secrets are set:**

```bash
gh secret list --repo <your-username>/student-api
```

Expected output:
```
ALB_DNS_NAME       ...
ASG_NAME           ...
AWS_ROLE_ARN       ...
DOCKERHUB_TOKEN    ...
DOCKERHUB_USERNAME ...
MONGODB_URI        ...
```

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

Run tests (needs a MongoDB):
```bash
# Spin up a local MongoDB with Docker:
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

> **Why do both `ci.yml` and `deploy.yml` run on push to `main`?** This is intentional. `ci.yml` covers both PRs and main pushes for fast feedback. `deploy.yml` runs only on main pushes and does the actual deployment. On a push to main, both run in parallel and lint/test are duplicated — this is acceptable overhead. In production you would typically skip the CI workflow on main or merge them.

---

## Part G — Push to Docker Hub

### Task 14 — Create `.github/workflows/deploy.yml` — build and push job

The `build-and-push` job:
1. Logs in with `docker/login-action@v3`
2. Builds with `--build-arg COMMIT_SHA=${{ github.sha }}` (embedded in the image)
3. Tags as `<username>/student-api:<sha>` + `<username>/student-api:latest`
4. Pushes both tags

> **Do not use a job `output` to pass the image name to the deploy job.** GitHub Actions silently suppresses any job output whose value matches a registered secret. Since the image name contains `DOCKERHUB_USERNAME`, the output is swallowed and the deploy job receives an empty string. Instead, reconstruct the image name directly in the deploy job:
> ```yaml
> IMAGE="${{ secrets.DOCKERHUB_USERNAME }}/student-api:${{ github.sha }}"
> ```

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

**First deploy on a fresh instance — timing note:**

When the ASG launches a new EC2 instance, the user data script takes 3–5 minutes to install Docker and AWS CLI. SSM Agent is pre-installed on Ubuntu 22.04 and starts immediately, so it can receive Run Commands before user data finishes. To prevent the deploy script from failing with `aws: not found`, add wait loops at the top of the SSM command script:

```bash
# Wait for user data to finish installing AWS CLI and Docker
for i in $(seq 1 30); do /usr/local/bin/aws --version >/dev/null 2>&1 && break; echo "Waiting for AWS CLI... $i/30"; sleep 10; done
export PATH=$PATH:/usr/local/bin
for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break; echo "Waiting for Docker... $i/30"; sleep 10; done
```

**SSM race condition — always capture instance IDs before `send-command`:**

The wait step must poll the same instances the command was sent to. If you query ASG InService instances separately (after sending the command), the ASG may have rotated an instance between the two calls, causing `InvocationDoesNotExist`. Capture IDs once, use the same list for both:

```bash
INSTANCE_IDS=$(aws autoscaling describe-auto-scaling-groups ...)
aws ssm send-command --instance-ids $INSTANCE_IDS ...
# then poll using the same $INSTANCE_IDS
```

**`aws ssm wait command-executed` times out after 100 seconds.** On a fresh instance, the deploy script waits for user data (3-5 min) before it can run. Use a manual polling loop instead:

```bash
for attempt in $(seq 1 60); do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query "Status" --output text 2>/dev/null || echo "Pending")
  [ "$STATUS" = "Success" ] && break
  [ "$STATUS" = "Failed" ] && exit 1
  sleep 10
done
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

- [ ] `gh secret list` shows all 6 secrets
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
