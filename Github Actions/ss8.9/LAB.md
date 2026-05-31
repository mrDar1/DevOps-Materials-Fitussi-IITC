# Lab 9 — GitHub Actions → Docker Hub → ALB + ASG

**No SSH. No AWS Access Keys. No port 22.**

---

## Architecture

```
git push → GitHub Actions
               │
               ├─ [Lint + Docker build check]
               │
               ├─ [docker push] ──────────→ Docker Hub (private repo)
               │                                  │
               └─ [OIDC → SSM SendCommand]         │
                          │                        │
                          ▼                        ▼
                   Auto Scaling Group ←── EC2 instances pull image
                          │             (credentials from SSM Param Store)
                          │
                   Application Load Balancer
                          │
                   http://<dns-name>   ← public DNS name
```

## Concepts Covered

| Concept | What you learn |
|---------|---------------|
| GitHub Actions multi-job pipelines | `needs`, `outputs`, job dependencies |
| Docker Hub | Private registry, access tokens, push/pull |
| AWS OIDC | Passwordless AWS auth from GitHub Actions |
| IAM Trust Policies | Scoping which repo can assume which role |
| SSM Parameter Store | Storing secrets; EC2 reads them at runtime |
| AWS Systems Manager | Remote command execution without SSH |
| EC2 Launch Templates | Auto-bootstrap Docker + AWS CLI on every new instance |
| Auto Scaling Groups | ELB health check type, scale in/out |
| Application Load Balancer | Internet-facing, provides DNS name |
| Target Groups | HTTP health checks on `/health` |
| Security Groups | Least-privilege: EC2 only accepts port 3000 from ALB |

## Required GitHub Secrets

| Secret | Where to get it |
|--------|----------------|
| `AWS_ROLE_ARN` | Output of Task 9 (OIDC role) |
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub → Account Settings → Security |
| `ASG_NAME` | Name you give the ASG in Task 8 (e.g. `student-api-asg`) |
| `ALB_DNS_NAME` | DNS name from the ALB in Task 7 |

---

## Part A — Docker Hub Setup

### Task 1 — Create a Docker Hub repository

1. Go to [hub.docker.com](https://hub.docker.com) and sign in.
2. Click **Create Repository**.
   - Name: `student-api`
   - Visibility: **Private**
3. Click **Create**.

Your image name will be: `<your-username>/student-api`

### Task 2 — Create an access token and store it in SSM Parameter Store

**Create the Docker Hub token:**

1. Docker Hub → your avatar → **Account Settings** → **Security** → **New Access Token**.
2. Description: `student-api-deploy`
3. Permissions: **Read, Write, Delete**
4. Copy the token — you will not see it again.

**Store credentials in AWS SSM Parameter Store** (these are used by EC2 instances to pull the image at deploy time):

```bash
# Store your Docker Hub username (plain string)
aws ssm put-parameter \
  --name /student-api/dockerhub/username \
  --value "<your-dockerhub-username>" \
  --type String \
  --region us-east-1

# Store your Docker Hub token (encrypted)
aws ssm put-parameter \
  --name /student-api/dockerhub/token \
  --value "<your-dockerhub-token>" \
  --type SecureString \
  --region us-east-1
```

> **Why SSM Parameter Store?** EC2 instances authenticate to Docker Hub at deploy time using their IAM role — no credentials baked into AMIs or scripts. This is the production pattern for secrets.

---

## Part B — AWS Infrastructure

### Task 3 — Security Groups

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

> **Note:** EC2 does NOT have port 22 or port 80 open. Port 3000 only accepts traffic from the ALB — not from the internet. Port 22 is never needed because SSM handles all remote commands.

> **Note:** The outbound `All traffic` rule on `ec2-sg` lets the SSM Agent make HTTPS calls to AWS endpoints, and lets Docker pull images from Docker Hub.

### Task 4 — EC2 IAM Role

Create an IAM role that EC2 instances will assume.

**Step 1 — Create the role:**
- Trusted entity: **AWS service → EC2**
- Role name: `student-api-ec2-role`

**Step 2 — Attach the managed policy:**
- `AmazonSSMManagedInstanceCore` — enables SSM Agent, Session Manager, and Run Command.

**Step 3 — Add an inline policy** for SSM Parameter Store access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/student-api/*"
    }
  ]
}
```

Name the inline policy: `StudentApiParameterStoreRead`

> This policy lets each EC2 instance read the Docker Hub credentials stored in Task 2 — but only the parameters under `/student-api/`.

**Step 4 — Create an Instance Profile** (the console does this automatically if you use the EC2 wizard; if using CLI, create it separately and add the role to it).

### Task 5 — Launch Template with User Data

A Launch Template defines how new ASG instances are configured. The User Data script runs automatically when an instance first boots.

**Create a Launch Template:**

- Name: `student-api-lt`
- AMI: **Ubuntu Server 22.04 LTS** (64-bit x86)
- Instance type: `t3.micro`
- IAM instance profile: `student-api-ec2-role` (from Task 4)
- Security groups: `ec2-sg` (from Task 3)
- No key pair (no SSH needed)

**User Data** (paste this in the **Advanced details → User data** field):

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

> Every instance launched from this template will have Docker, AWS CLI, and `jq` ready before the first deployment hits it.

### Task 6 — Target Group

- Type: **Instances**
- Name: `student-api-tg`
- Protocol: **HTTP**, Port: **3000**
- VPC: same as your security groups
- Health check path: `/health`
- Health check interval: 30 seconds
- Healthy threshold: 2 consecutive successes

Leave the target group empty for now — the ASG will register instances automatically.

### Task 7 — Application Load Balancer

- Name: `student-api-alb`
- Scheme: **Internet-facing**
- IP address type: IPv4
- Subnets: select **at least 2 public subnets** (different AZs)
- Security groups: `alb-sg` (from Task 3)
- Listener: HTTP port 80 → forward to `student-api-tg`

After creation, find and copy the **DNS name** — it looks like:
```
student-api-alb-1234567890.us-east-1.elb.amazonaws.com
```

Add this as the `ALB_DNS_NAME` GitHub secret.

### Task 8 — Auto Scaling Group

- Name: `student-api-asg`
- Launch template: `student-api-lt` (from Task 5)
- VPC and subnets: same as your ALB — at least 2 public subnets across 2 AZs
- Load balancing: attach to **`student-api-tg`**
- Health check type: **ELB** (not just EC2 — this means ALB's `/health` check determines instance health)
- Health check grace period: 120 seconds
- Desired capacity: 1
- Minimum capacity: 1
- Maximum capacity: 2

> With ELB health check type, if an instance's `/health` endpoint stops returning 200, the ASG terminates it and launches a replacement automatically.

---

## Part C — GitHub OIDC

### Task 9 — Create OIDC Provider and IAM Role

OIDC lets GitHub Actions assume an AWS IAM role without storing any AWS credentials in GitHub.

**Step 1 — Add GitHub as an OIDC identity provider in AWS:**

IAM → Identity providers → Add provider

- Provider type: **OpenID Connect**
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

**Step 2 — Create the IAM role for GitHub Actions:**

- Trusted entity: **Web identity**
- Identity provider: `token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`
- Role name: `student-api-github-actions-role`

**Step 3 — Edit the trust policy** to restrict to your repo:

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
          "token.actions.githubusercontent.com:sub": "repo:<YOUR_GITHUB_ORG>/<YOUR_REPO>:*"
        }
      }
    }
  ]
}
```

**Step 4 — Attach an inline permissions policy:**

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
      "Sid": "ASGDescribe",
      "Effect": "Allow",
      "Action": "autoscaling:DescribeAutoScalingGroups",
      "Resource": "*"
    }
  ]
}
```

> No ECR permissions needed — Docker Hub authentication is handled by Docker Hub tokens, not AWS. The OIDC role only needs to run SSM commands and describe the ASG.

**Step 5 — Copy the Role ARN** and add it as the `AWS_ROLE_ARN` GitHub secret.

---

## Part D — Local Docker Build

### Task 10 — Build and run the container locally

```bash
cd express-api
npm install
npm run lint

# Build the image
docker build --build-arg COMMIT_SHA=local-test -t student-api:local .

# Run it
docker run -d --name student-api -p 3000:3000 student-api:local

# Verify
curl http://localhost:3000/
curl http://localhost:3000/health
curl http://localhost:3000/version

# Clean up
docker stop student-api && docker rm student-api
```

Expected responses:
```json
{"message":"Hello from student-api!"}
{"status":"ok"}
{"version":"1.0","commit":"local-test"}
```

---

## Part E — CI Pipeline

### Task 11 — Create `.github/workflows/ci.yml`

Create the file in your repo. This pipeline runs on every push and pull request:

- **Job 1 `lint`**: installs dependencies and runs ESLint
- **Job 2 `build`**: builds the Docker image (no push) to verify the Dockerfile is valid

See `solution/.github/workflows/ci.yml` for the complete file.

Push a commit and verify both jobs pass in the Actions tab.

---

## Part F — Push to Docker Hub

### Task 12 — Create `.github/workflows/deploy.yml` — build and push job

Add your Docker Hub secrets to GitHub:

- `DOCKERHUB_USERNAME` — your Docker Hub username
- `DOCKERHUB_TOKEN` — the access token from Task 2

The `build-and-push` job in `deploy.yml`:

1. Logs in with `docker/login-action@v3` using `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`
2. Builds the image with `--build-arg COMMIT_SHA=${{ github.sha }}`
3. Tags it as `<username>/student-api:<sha>` and `<username>/student-api:latest`
4. Pushes both tags
5. Outputs the full image URI (with SHA tag) for the deploy job

Check Docker Hub — you should see the new tag appear after the workflow runs.

---

## Part G — Deploy via SSM

### Task 13 — Complete `deploy.yml` — deploy job

The `deploy` job runs after `build-and-push` succeeds:

**Step 1 — OIDC auth:**  
`aws-actions/configure-aws-credentials@v4` exchanges the GitHub token for short-lived AWS credentials. No AWS keys stored anywhere.

**Step 2 — SSM SendCommand:**  
Targets instances by ASG tag instead of hardcoded IDs:
```
--targets "Key=tag:aws:autoscaling:groupName,Values=<ASG_NAME>"
```

The SSM script runs on each EC2 instance:
```bash
# Instance reads Docker Hub credentials from SSM Parameter Store using its IAM role
DH_USER=$(aws ssm get-parameter --name /student-api/dockerhub/username ...)
DH_TOKEN=$(aws ssm get-parameter --name /student-api/dockerhub/token --with-decryption ...)
echo "$DH_TOKEN" | docker login --username "$DH_USER" --password-stdin

# Pull, stop old container, start new container
docker pull <image>
docker stop student-api && docker rm student-api
docker run -d --name student-api --restart unless-stopped \
  -p 3000:3000 -e COMMIT_SHA=<sha> <image>
```

**Step 3 — Wait for all instances:**  
Discovers in-service instance IDs from the ASG description, then waits on each one:
```bash
aws ssm wait command-executed \
  --command-id $COMMAND_ID \
  --instance-id $INSTANCE_ID
```

**Step 4 — Health check via ALB:**  
Polls `http://<ALB_DNS_NAME>/health` every 10 seconds for up to 3 minutes (18 attempts). Exits 0 on first HTTP 200.

**Trigger the pipeline:**

Push a commit to `main`. Watch the three jobs run in order:

```
lint → build-and-push → deploy
```

Once the deploy job prints:
```
Healthy at: http://<your-alb-dns>
```

Test it:
```bash
curl http://<ALB_DNS_NAME>/
curl http://<ALB_DNS_NAME>/health
curl http://<ALB_DNS_NAME>/version
```

---

## Verification Checklist

- [ ] Docker Hub shows `<username>/student-api` with both `:latest` and `:<sha>` tags
- [ ] ALB DNS name responds on port 80 (not 3000)
- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] `GET /version` shows the commit SHA of your latest push
- [ ] No port 22 open on EC2 security group
- [ ] No AWS Access Keys in GitHub secrets (only `AWS_ROLE_ARN`)
- [ ] GitHub Actions → OIDC role has no ECR or S3 permissions

---

## Bonus Tasks

### Bonus 1 — Make the Docker Hub repo public

Change the Docker Hub repo visibility to **Public**.

What changes in the infrastructure?
- EC2 instances no longer need Docker Hub credentials to pull — `docker pull <image>` works without login.
- Remove the `/student-api/dockerhub/*` parameters from SSM Parameter Store.
- Remove the `ssm:GetParameter` inline policy from the EC2 IAM role.
- Update the SSM deploy script to skip the login step.

Discuss: what are the trade-offs between public vs. private registries in production?

### Bonus 2 — Trigger a scale-out and verify rolling deploy

1. Change the ASG desired capacity from 1 to 2.
2. Wait for the second instance to pass ALB health checks.
3. Push a code change (e.g., change the message in `GET /`).
4. Watch the deploy pipeline send the SSM command to **both** instances.
5. Verify the new version is running on both — refresh `/version` several times and confirm both instances serve the new SHA.

### Bonus 3 — Slack notification on deploy

Add a final step to `deploy.yml` that posts a Slack message after the health check passes:

```yaml
- name: Notify Slack
  if: success()
  run: |
    curl -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" \
      -H 'Content-type: application/json' \
      --data "{\"text\":\"Deployed \`${{ github.sha }}\` to http://${{ secrets.ALB_DNS_NAME }} :rocket:\"}"
```

### Bonus 4 — Self-healing on instance replacement

Extend the Launch Template User Data so that when a replacement instance boots (e.g. after a health check failure terminates an old one), it automatically pulls and starts the latest container — no pipeline run needed:

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

# Auto-start latest image on first boot
REGION="us-east-1"
DH_USER=$(aws ssm get-parameter --region "$REGION" \
  --name /student-api/dockerhub/username \
  --query Parameter.Value --output text)
DH_TOKEN=$(aws ssm get-parameter --region "$REGION" \
  --name /student-api/dockerhub/token \
  --with-decryption --query Parameter.Value --output text)

echo "$DH_TOKEN" | docker login --username "$DH_USER" --password-stdin

IMAGE="$DH_USER/student-api:latest"
docker pull "$IMAGE"
docker run -d --name student-api \
  --restart unless-stopped \
  -p 3000:3000 \
  "$IMAGE"
```

> With this User Data, a new instance launched by the ASG bootstraps itself to production state without any human or pipeline intervention. This is the self-healing pattern.

---

## How the pieces fit together

```
GitHub Secrets (CI/CD machine)        AWS SSM Parameter Store (runtime)
────────────────────────────          ─────────────────────────────────
DOCKERHUB_USERNAME  → push image      /student-api/dockerhub/username  ─┐
DOCKERHUB_TOKEN     → push image      /student-api/dockerhub/token     ─┤→ EC2 reads at deploy
AWS_ROLE_ARN        → OIDC auth                                          │
ASG_NAME            → SSM target      EC2 IAM Role reads SSM params ─────┘
ALB_DNS_NAME        → health check

No AWS keys in GitHub. No credentials in EC2 User Data. No SSH keys. No port 22.
```
