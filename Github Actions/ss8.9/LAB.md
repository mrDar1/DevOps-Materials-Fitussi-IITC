# Lab 9 — Production Backend Deployment

## GitHub Actions → ECR → EC2 (No SSH, No Keys)

### Goal

By the end of this lab, every push to `main` triggers a fully automated deployment:

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
```

This lab is the **backend equivalent** of what you already did with S3 + CloudFront for the frontend. The flow is the same — push triggers pipeline, pipeline deploys — but the target is a running container on a real server.

---

## The Application

The `express-api/` folder contains a ready-to-use Node.js API.

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

Add these under **Settings → Secrets and variables → Actions** before starting Part E:

| Secret              | Value                                                   |
|---------------------|---------------------------------------------------------|
| `AWS_ROLE_ARN`      | ARN of the IAM role you create in Part C               |
| `EC2_INSTANCE_ID`   | Your EC2 instance ID (e.g. `i-0abc1234def567890`)     |
| `EC2_PUBLIC_IP`     | Your EC2 public IP address                             |

---

## Part A — AWS Infrastructure

### Task 1 — Create ECR Repository

1. Open the **ECR** console in AWS
2. Click **Create repository**
3. Select **Private**
4. Name it: `student-api`
5. Leave all other settings at default and create

**Deliverable:** Screenshot of the created ECR repository.

---

### Task 2 — Launch EC2 Instance

| Setting                  | Value                             |
|--------------------------|-----------------------------------|
| AMI                      | Ubuntu Server 22.04 LTS           |
| Instance type            | t3.micro                          |
| Subnet                   | Any public subnet                 |
| Auto-assign public IP    | Enable                            |
| Key pair                 | **Proceed without key pair**      |
| Inbound security group   | HTTP (port 80) from `0.0.0.0/0`  |

> Port 22 is not needed. Management will go through Systems Manager.

**Deliverable:** EC2 instance in "Running" state.

---

### Task 3 — Install Docker on the EC2

Research: *"How to install Docker on Ubuntu EC2"*

Connect to the instance using **EC2 Instance Connect** (works without a key pair).

After installation, verify:

```bash
docker --version
```

**Deliverable:** Share the output of `docker --version`.

---

## Part B — Systems Manager

### Task 4 — Register EC2 as an SSM Managed Node

For GitHub Actions to send shell commands to the EC2 without SSH, the instance must register with AWS Systems Manager.

Research: *"How to manage EC2 using AWS Systems Manager"*

**Hint — IAM Role for EC2:**

Create an IAM Role (use case: EC2) and attach these two policies:

| Policy                                 | Why                                          |
|----------------------------------------|----------------------------------------------|
| `AmazonSSMManagedInstanceCore`         | Allows SSM Agent to communicate with AWS     |
| `AmazonEC2ContainerRegistryReadOnly`   | Allows EC2 to pull images from ECR           |

Steps:
1. Create the role in IAM
2. Go to your EC2 → **Actions → Security → Modify IAM role**
3. Attach the new role
4. Wait 2–3 minutes for the SSM Agent to register

**Deliverable:** Your EC2 appears under **Systems Manager → Fleet Manager → Managed Nodes**.

---

## Part C — OIDC (Keyless AWS Authentication)

### Task 5 — Create GitHub OIDC Trust

GitHub Actions will authenticate to AWS using OpenID Connect — no access keys will be stored anywhere.

Research: *"GitHub Actions OIDC AWS"*

#### Step 1 — Identity Provider

In **IAM → Identity providers → Add provider**:

| Field         | Value                                         |
|---------------|-----------------------------------------------|
| Provider type | OpenID Connect                                |
| Provider URL  | `https://token.actions.githubusercontent.com` |
| Audience      | `sts.amazonaws.com`                           |

#### Step 2 — IAM Role with Trust Policy

Create a new IAM Role (trusted entity: Web identity, provider: `token.actions.githubusercontent.com`) and edit the trust policy to scope it to your repository:

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

Attach the following inline policy to the role:

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

**Deliverable:** Copy the Role ARN and add it as the `AWS_ROLE_ARN` secret in your repository.

---

## Part D — Local Docker Build

### Task 6 — Build and Test the Container

1. Copy `express-api/` into your repository and install dependencies:

   ```bash
   cd express-api
   npm install
   ```

   > Important: commit the generated `package-lock.json` — the Dockerfile uses `npm ci` which requires it.

2. Build the Docker image:

   ```bash
   docker build -t student-api:local .
   ```

3. Run the container:

   ```bash
   docker run -d -p 3000:3000 --name api-test student-api:local
   ```

4. Test the health endpoint:

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

### Task 7 — CI Pipeline

Create `.github/workflows/ci.yml` in your repository.

The pipeline:

```
Lint
  ↓
Build Docker Image   (local only — no push yet)
```

Requirements:
- Trigger on `push` to `main` and `pull_request` to `main`
- `lint` job: run `npm install` and `npm run lint` inside the `express-api/` directory
- `build` job: depends on `lint`, builds the Docker image with `docker build`

Commit and push. The workflow should appear in the **Actions** tab with a green status.

**Deliverable:** Green CI workflow run in the Actions tab.

---

## Part F — Push to ECR

### Task 8 — Authenticate and Push

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

### Task 9 — Deploy via SSM

Add a `deploy` job that runs after the image is pushed.

The job sends a shell script to the EC2 using `aws ssm send-command`.

**Commands the EC2 must run, in order:**

```bash
# 1 — Login to ECR from inside the EC2
aws ecr get-login-password --region <REGION> \
  | docker login --username AWS --password-stdin <ECR_REGISTRY>

# 2 — Pull the new image
docker pull <IMAGE>

# 3 — Stop and remove the old container (ignore error if it does not exist)
docker stop student-api 2>/dev/null || true
docker rm   student-api 2>/dev/null || true

# 4 — Start the new container
docker run -d \
  --name student-api \
  --restart unless-stopped \
  -p 80:3000 \
  <IMAGE>
```

**After sending the command, wait for it to complete:**

```bash
aws ssm wait command-executed \
  --command-id "<COMMAND_ID>" \
  --instance-id "${{ secrets.EC2_INSTANCE_ID }}"
```

**Tip:** Use `jq` to build the `--parameters` JSON safely — it handles special characters in image URIs and avoids quoting issues:

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
    "docker run -d --name \($name) --restart unless-stopped -p 80:3000 \($image)"
  ]}')

aws ssm send-command \
  --instance-ids  "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters    "$PARAMS" \
  --query         "Command.CommandId" \
  --output        text
```

**Deliverable:** `http://<EC2_PUBLIC_IP>` returns a valid JSON response.

---

## Part H — Health Validation

### Task 10 — Automated Health Check

After deployment, add a step that polls the `/health` endpoint to confirm the application is up.

Requirements:
- Poll `http://<EC2_PUBLIC_IP>/health`
- Try at least 10 times with a 10-second wait between attempts
- Exit `0` (success) on the first `200 OK`
- Exit `1` (failure) if all attempts are exhausted

**Deliverable:** The pipeline log shows `Health check passed` after every deployment.

---

## Bonus Tasks

### Bonus 1 — Real `/version` Endpoint

Make the `/version` endpoint return the actual commit SHA.

Pass it as a Docker build argument:

```bash
docker build --build-arg COMMIT_SHA=${{ github.sha }} ...
```

The `Dockerfile` already accepts `ARG COMMIT_SHA=local` and sets `ENV COMMIT_SHA`. The route in `routes/index.js` already reads `process.env.COMMIT_SHA`.

**Deliverable:** `GET /version` returns the real 40-character commit SHA.

---

### Bonus 2 — Parallel Jobs

Add a `test` job and make it run **in parallel with `lint`**. Both must succeed before `build-and-push` starts.

```
lint ──┐
       ├──▶  build-and-push  ──▶  deploy
test ──┘
```

Use `needs: [lint, test]` on the `build-and-push` job.

For the `test` job, add a placeholder if the project has no tests yet:

```bash
echo "All tests passed"
```

**Deliverable:** The Actions tab shows `lint` and `test` running simultaneously.

---

### Bonus 3 — Build Metadata Artifact

After pushing the image, save deployment information as a workflow artifact.

Create a file `build-info.json`:

```json
{
  "image":        "<full ECR image URI with SHA tag>",
  "commit":       "<github.sha>",
  "pushed_at":    "<ISO 8601 timestamp>",
  "workflow_run": "<github.run_number>"
}
```

Upload it using `actions/upload-artifact@v4`.

**Deliverable:** The workflow run contains a downloadable `build-info` artifact.

---

## Architecture Reference

```
Developer Machine
        │
        │  git push
        ▼
  GitHub Repository
        │
        │  push event triggers workflow
        ▼
  GitHub Actions Runner
        │
        ├─── lint (+ test in Bonus 2)
        │
        ├─── OIDC → AssumeRole → AWS   (no static credentials)
        │              │
        │              ├── docker build
        │              └── docker push ──────────▶ ECR
        │
        └─── aws ssm send-command
                         │
                         ▼
                   EC2 Instance  (SSM Agent receives command)
                         │
                         ├── docker pull   (from ECR)
                         ├── docker stop   (old container)
                         ├── docker rm     (old container)
                         └── docker run    (new container)
                                    │
                                    ▼
                            :80  ──▶  Express API
```

---

## Concepts Covered

| Topic                 | What You Practiced                                              |
|-----------------------|-----------------------------------------------------------------|
| GitHub Actions        | Multi-job CI/CD pipeline                                        |
| OIDC                  | Passwordless AWS authentication — no keys in GitHub            |
| IAM Trust Policy      | Scoping which repository can assume the role                    |
| Docker                | Build, tag, and push a production image                         |
| ECR                   | AWS-managed private Docker registry                             |
| EC2                   | Running a container on a real Linux server                      |
| Systems Manager       | Remote command execution without SSH or port 22                 |
| Health Checks         | Automated post-deployment validation in the pipeline            |
| Image Tagging         | `latest` for convenience + SHA tag for immutable traceability   |
| Job Dependencies      | `needs:` for order and parallel execution                       |
