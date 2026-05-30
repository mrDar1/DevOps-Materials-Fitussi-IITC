# Lab 9 — Production Backend Deployment

## GitHub Actions → ECR → ALB → EC2 (No SSH, No Keys)

### Goal

By the end of this lab, every push to `main` triggers a fully automated deployment. The final output of the pipeline is a real DNS name:

```
Git Push
    ↓
GitHub Actions
    ↓
OIDC Login to AWS          ← no access keys stored anywhere
    ↓
Build Docker Image
    ↓
Push Image to ECR
    ↓
SSM Send Command            ← no SSH, port 22 stays closed
    ↓
EC2 Pull New Image
    ↓
Restart Container
    ↓
Health Check via ALB
    ↓
✅ http://<alb-dns-name>.elb.amazonaws.com
```

**No AWS access keys stored in GitHub. No SSH keys. Port 22 closed. EC2 not directly exposed to the internet.**

---

## The Application

The `express-api/` folder contains a ready-to-use Node.js API:

```
express-api/
├── app.js
├── package.json
├── Dockerfile
└── routes/
    └── index.js
```

| Endpoint       | Response                                               |
|----------------|--------------------------------------------------------|
| `GET /`        | `{ "message": "Hello from student-api!" }`            |
| `GET /health`  | `{ "status": "ok" }`                                  |
| `GET /version` | `{ "version": "1.0", "commit": "local" }`            |

**Copy this folder into your own GitHub repository before starting.**

---

## Required Repository Secrets

Add these under **Settings → Secrets and variables → Actions**:

| Secret              | Value                                                        |
|---------------------|--------------------------------------------------------------|
| `AWS_ROLE_ARN`      | ARN of the IAM role you create in Part C                    |
| `EC2_INSTANCE_ID`   | Your EC2 instance ID (e.g. `i-0abc1234def567890`)          |
| `ALB_DNS_NAME`      | ALB DNS name you get at the end of Part A (e.g. `my-alb-123456789.us-east-1.elb.amazonaws.com`) |

---

## Final Architecture

```
Internet
    │  HTTP :80
    ▼
Application Load Balancer
    │  HTTP :3000  (only to the EC2's security group)
    ▼
EC2 Instance
    │
    ▼
Docker Container  (Express API on port 3000)
```

- The EC2 security group allows **port 3000 only from the ALB's security group** — not from the internet.
- The ALB security group allows **port 80 from the internet**.
- No one can hit the EC2 directly.

---

## Part A — AWS Infrastructure

### Task 1 — Create ECR Repository

1. Open the **ECR** console
2. Click **Create repository**
3. Select **Private**
4. Name: `student-api`
5. Leave all other settings at default → Create

**Deliverable:** Screenshot of the created ECR repository.

---

### Task 2 — Launch EC2 Instance

Create **two security groups** before launching the instance.

#### Security Group 1 — `alb-sg`

| Rule      | Type | Protocol | Port | Source        |
|-----------|------|----------|------|---------------|
| Inbound   | HTTP | TCP      | 80   | `0.0.0.0/0`  |
| Outbound  | All  | All      | All  | `0.0.0.0/0`  |

#### Security Group 2 — `ec2-sg`

| Rule      | Type        | Protocol | Port | Source               |
|-----------|-------------|----------|------|----------------------|
| Inbound   | Custom TCP  | TCP      | 3000 | `alb-sg` (select from list) |
| Inbound   | HTTPS       | TCP      | 443  | `0.0.0.0/0`  (for SSM agent) |
| Outbound  | All         | All      | All  | `0.0.0.0/0`          |

> The EC2 only accepts traffic on port 3000 from the ALB — not from the internet directly.

#### Launch the EC2

| Setting               | Value                       |
|-----------------------|-----------------------------|
| AMI                   | Ubuntu Server 22.04 LTS     |
| Instance type         | t3.micro                    |
| Subnet                | Any **public** subnet       |
| Auto-assign public IP | Enable                      |
| Key pair              | **Proceed without key pair** |
| Security group        | `ec2-sg`                    |

**Deliverable:** EC2 instance in "Running" state.

---

### Task 3 — Install Docker on the EC2

Research: *"How to install Docker on Ubuntu EC2"*

Connect using **EC2 Instance Connect** (no key pair needed).

After installing Docker, verify:

```bash
docker --version
```

**Deliverable:** Share the output of `docker --version`.

---

### Task 4 — Create a Target Group

The ALB needs a Target Group to know where to send traffic.

1. Open **EC2 → Target Groups → Create target group**
2. Target type: **Instances**
3. Target group name: `student-api-tg`
4. Protocol: **HTTP**
5. Port: **3000**
6. Health check path: `/health`
7. Click **Next** → select your EC2 instance → **Include as pending below** → **Create target group**

**Deliverable:** Target group created with your EC2 registered as a target.

---

### Task 5 — Create the Application Load Balancer

1. Open **EC2 → Load Balancers → Create load balancer**
2. Choose **Application Load Balancer**
3. Name: `student-api-alb`
4. Scheme: **Internet-facing**
5. IP address type: **IPv4**
6. Network mapping: select **at least 2 Availability Zones** (both with public subnets)
7. Security group: `alb-sg`
8. Listener: HTTP :80 → Forward to `student-api-tg`
9. Create load balancer

After creation, copy the **DNS name** from the ALB details page.

> Example: `student-api-alb-123456789.us-east-1.elb.amazonaws.com`

**Add this DNS name as the `ALB_DNS_NAME` secret in your repository.**

**Deliverable:** ALB in "Active" state. DNS name copied.

---

## Part B — Systems Manager

### Task 6 — Register EC2 as an SSM Managed Node

For GitHub Actions to send shell commands to the EC2 without SSH, the instance must be registered with Systems Manager.

Research: *"How to manage EC2 using AWS Systems Manager"*

**Create an IAM Role (use case: EC2) and attach these two policies:**

| Policy                                 | Why                                          |
|----------------------------------------|----------------------------------------------|
| `AmazonSSMManagedInstanceCore`         | Allows SSM Agent to communicate with AWS     |
| `AmazonEC2ContainerRegistryReadOnly`   | Allows the EC2 to pull images from ECR       |

Steps:
1. Create the role in IAM
2. Go to your EC2 → **Actions → Security → Modify IAM role**
3. Attach the new role
4. Wait 2–3 minutes for the SSM Agent to register

**Deliverable:** Your EC2 appears under **Systems Manager → Fleet Manager → Managed Nodes**.

---

## Part C — OIDC (Keyless AWS Authentication)

### Task 7 — Create GitHub OIDC Trust

GitHub Actions will authenticate to AWS using OpenID Connect. No access keys will be stored anywhere.

Research: *"GitHub Actions OIDC AWS"*

#### Step 1 — Identity Provider

In **IAM → Identity providers → Add provider**:

| Field         | Value                                         |
|---------------|-----------------------------------------------|
| Provider type | OpenID Connect                                |
| Provider URL  | `https://token.actions.githubusercontent.com` |
| Audience      | `sts.amazonaws.com`                           |

#### Step 2 — IAM Role with Trust Policy

Create a new IAM Role (trusted entity: **Web identity**, provider: `token.actions.githubusercontent.com`) and edit the trust policy to scope it to your repository:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>:*"
        }
      }
    }
  ]
}
```

#### Step 3 — Permissions for the Role

Attach the following inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "ECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "arn:aws:ecr:*:<YOUR_ACCOUNT_ID>:repository/student-api"
    },
    {
      "Sid": "SSMDeploy",
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation",
        "ssm:DescribeInstanceInformation"
      ],
      "Resource": "*"
    }
  ]
}
```

**Deliverable:** Copy the Role ARN → add it as the `AWS_ROLE_ARN` secret in your repository.

---

## Part D — Local Docker Build

### Task 8 — Build and Test the Container

1. Copy `express-api/` into your repository and install dependencies:

   ```bash
   cd express-api
   npm install
   ```

   > Important: commit the generated `package-lock.json`. The Dockerfile uses `npm ci` which requires it.

2. Build the Docker image:

   ```bash
   docker build -t student-api:local .
   ```

3. Run the container:

   ```bash
   docker run -d -p 3000:3000 --name api-test student-api:local
   ```

4. Test:

   ```bash
   curl http://localhost:3000/health
   ```

5. Clean up:

   ```bash
   docker stop api-test && docker rm api-test
   ```

**Deliverable:** `GET /health` returns `{ "status": "ok" }`.

---

## Part E — GitHub Actions CI

### Task 9 — CI Pipeline

Create `.github/workflows/ci.yml` in your repository.

The pipeline:

```
Lint
  ↓
Build Docker Image   (local only — no push yet)
```

Requirements:
- Trigger on `push` to `main` and `pull_request` to `main`
- `lint` job: run `npm install` and `npm run lint` inside `express-api/`
- `build` job: depends on `lint`, builds the Docker image with `docker build`

**Deliverable:** Green CI workflow run in the Actions tab.

---

## Part F — Push to ECR

### Task 10 — Authenticate and Push

Update your workflow to authenticate to AWS via OIDC and push the image.

**Required top-level permissions block:**

```yaml
permissions:
  id-token: write
  contents: read
```

**Authentication step:**

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: us-east-1
```

**ECR login step:**

```yaml
- name: Login to ECR
  id: ecr-login
  uses: aws-actions/amazon-ecr-login@v2
```

**Push the image with two tags:**
- `latest`
- `${{ github.sha }}` (full commit SHA — immutable, traceable)

**Deliverable:** After a push to `main`, the ECR repository shows both image tags.

---

## Part G — Deployment

### Task 11 — Deploy via SSM

Add a `deploy` job that runs after the image is pushed.

The job sends a shell script to the EC2 using `aws ssm send-command`.

**Commands the EC2 must run, in order:**

```bash
# 1 — Login to ECR from inside the EC2
aws ecr get-login-password --region <REGION> \
  | docker login --username AWS --password-stdin <ECR_REGISTRY>

# 2 — Pull the new image
docker pull <IMAGE>

# 3 — Stop and remove the old container
docker stop student-api 2>/dev/null || true
docker rm   student-api 2>/dev/null || true

# 4 — Start the new container on port 3000 (ALB forwards here)
docker run -d \
  --name student-api \
  --restart unless-stopped \
  -p 3000:3000 \
  <IMAGE>
```

> The container binds to port 3000, not 80. The ALB target group was configured to forward to port 3000.

**After sending the command, wait for it to complete:**

```bash
aws ssm wait command-executed \
  --command-id "<COMMAND_ID>" \
  --instance-id "${{ secrets.EC2_INSTANCE_ID }}"
```

**Tip:** Use `jq` to build the SSM `--parameters` JSON safely:

```bash
PARAMS=$(jq -cn \
  --arg region   "us-east-1" \
  --arg registry "$REGISTRY" \
  --arg image    "$IMAGE" \
  --arg name     "student-api" \
  '{commands: [
    "aws ecr get-login-password --region \($region) | docker login --username AWS --password-stdin \($registry)",
    "docker pull \($image)",
    "docker stop \($name) 2>/dev/null || true",
    "docker rm \($name) 2>/dev/null || true",
    "docker run -d --name \($name) --restart unless-stopped -p 3000:3000 \($image)"
  ]}')

aws ssm send-command \
  --instance-ids  "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters    "$PARAMS" \
  --query         "Command.CommandId" \
  --output        text
```

**Deliverable:** The workflow completes without errors. The SSM command log shows all 5 Docker steps succeeding.

---

## Part H — Health Validation via ALB

### Task 12 — Automated Health Check

After deployment, add a step that polls the `/health` endpoint **through the ALB** — not the EC2 directly.

Requirements:
- Poll `http://<ALB_DNS_NAME>/health`
- Try at least 10 times with 10-second intervals
- Exit `0` on the first `200 OK`
- Exit `1` if all attempts fail
- On success, print the full ALB URL so it appears in the pipeline log

**Deliverable:** The pipeline log ends with:

```
Health check passed on attempt N
Application is live at: http://<alb-dns-name>.elb.amazonaws.com
```

---

## Bonus Tasks

### Bonus 1 — Real `/version` Endpoint

Make the `/version` endpoint return the actual commit SHA.

Pass it as a Docker build argument:

```bash
docker build --build-arg COMMIT_SHA=${{ github.sha }} ...
```

The `Dockerfile` already accepts `ARG COMMIT_SHA=local` and sets `ENV COMMIT_SHA`. The route already reads `process.env.COMMIT_SHA`.

**Deliverable:** `GET /version` returns the real 40-character commit SHA.

---

### Bonus 2 — Parallel Jobs

Add a `test` job and make it run **in parallel with `lint`**. Both must finish before `build-and-push` starts:

```
lint ──┐
       ├──▶  build-and-push  ──▶  deploy
test ──┘
```

Use `needs: [lint, test]` on the `build-and-push` job.

**Deliverable:** The Actions tab shows `lint` and `test` running simultaneously.

---

### Bonus 3 — Build Metadata Artifact

After pushing the image, save deployment metadata using `actions/upload-artifact@v4`.

Create a file `build-info.json`:

```json
{
  "image":        "<full ECR image URI with SHA tag>",
  "commit":       "<github.sha>",
  "pushed_at":    "<ISO 8601 timestamp>",
  "workflow_run": "<github.run_number>",
  "alb_url":      "http://<ALB_DNS_NAME>"
}
```

**Deliverable:** Workflow run contains a downloadable `build-info` artifact.

---

## Architecture Reference

```
Developer Machine
        │
        │  git push
        ▼
  GitHub Repository
        │
        │  push event
        ▼
  GitHub Actions Runner
        │
        ├── lint
        │
        ├── OIDC → AssumeRole → AWS   (no static credentials stored)
        │              │
        │              ├── docker build
        │              └── docker push ─────────▶ ECR
        │
        ├── aws ssm send-command
        │                │
        │                ▼
        │          EC2 Instance  (SSM Agent)
        │                │
        │                ├── docker pull   (from ECR)
        │                ├── docker stop
        │                ├── docker rm
        │                └── docker run -p 3000:3000
        │
        └── health check
                  │  HTTP GET /health
                  ▼
       Application Load Balancer  (:80)
                  │  forwards to :3000
                  ▼
             EC2 Container  (Express API)


Final URL: http://<alb-dns-name>.us-east-1.elb.amazonaws.com
```

---

## Security Model

| Component         | Exposed to internet | Traffic allowed from       |
|-------------------|---------------------|----------------------------|
| ALB               | Yes (port 80)       | `0.0.0.0/0`               |
| EC2 port 3000     | No                  | ALB security group only    |
| EC2 port 22 (SSH) | No                  | Nobody — no key pair      |
| EC2 management    | Via SSM only        | AWS Systems Manager service |

---

## Concepts Covered

| Topic                 | What You Practiced                                               |
|-----------------------|------------------------------------------------------------------|
| GitHub Actions        | Multi-job CI/CD pipeline                                         |
| OIDC                  | Passwordless AWS auth — no keys stored in GitHub               |
| IAM Trust Policy      | Scoping which repository can assume the role                     |
| Docker                | Build, tag, and push a production image                          |
| ECR                   | AWS-managed private Docker registry                              |
| EC2                   | Running a container on a real server                             |
| Security Groups       | Network-layer isolation between ALB and EC2                      |
| Application Load Balancer | DNS-named entry point, health-aware routing                  |
| Target Groups         | ALB routing to container port 3000                               |
| Systems Manager       | Remote command execution without SSH or port 22                  |
| Health Checks         | Pipeline validates through ALB before reporting success          |
| Image Tagging         | `latest` + SHA tag for immutable traceability                    |
