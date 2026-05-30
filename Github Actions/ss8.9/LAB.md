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

| Secret              | Value                                                                                       |
|---------------------|---------------------------------------------------------------------------------------------|
| `AWS_ROLE_ARN`      | ARN of the IAM role you create in Part B                                                   |
| `EC2_INSTANCE_ID`   | Your EC2 instance ID (e.g. `i-0abc1234def567890`)                                         |
| `ALB_DNS_NAME`      | ALB DNS name from Task 6 (e.g. `student-api-alb-123456789.us-east-1.elb.amazonaws.com`)   |

---

## Final Architecture

```
Internet
    │  HTTP :80
    ▼
Application Load Balancer   (alb-sg: allows :80 from internet)
    │  HTTP :3000
    ▼
EC2 Instance                (ec2-sg: allows :3000 from alb-sg only)
    │
    ▼
Docker Container            (Express API on port 3000)
```

The EC2 has no open ports reachable from the internet. Management is handled exclusively through AWS Systems Manager.

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

Create **two security groups first**, then launch the instance.

#### Security Group 1 — `alb-sg`

| Direction | Protocol | Port | Source       |
|-----------|----------|------|--------------|
| Inbound   | TCP      | 80   | `0.0.0.0/0` |
| Outbound  | All      | All  | `0.0.0.0/0` |

#### Security Group 2 — `ec2-sg`

| Direction | Protocol | Port | Source                       |
|-----------|----------|------|------------------------------|
| Inbound   | TCP      | 3000 | `alb-sg` (select from list)  |
| Outbound  | All      | All  | `0.0.0.0/0`                  |

> **Why no port 22 and no port 443 inbound?**
> - Port 22 is not needed — there is no key pair and SSH is never used.
> - Port 443 inbound is not needed for SSM. The SSM Agent makes *outbound* HTTPS connections to AWS endpoints, which the Outbound rule already covers.
> - Port 3000 inbound is scoped to `alb-sg` only — the EC2 accepts application traffic exclusively from the ALB.

#### Launch the EC2

| Setting               | Value                         |
|-----------------------|-------------------------------|
| AMI                   | Ubuntu Server 22.04 LTS       |
| Instance type         | t3.micro                      |
| Subnet                | Any **public** subnet         |
| Auto-assign public IP | Enable                        |
| Key pair              | **Proceed without key pair**  |
| Security group        | `ec2-sg`                      |

**Deliverable:** EC2 instance in "Running" state.

---

### Task 3 — Create EC2 IAM Role and Register with SSM

The EC2 needs an IAM role so that:
- The SSM Agent can communicate with AWS Systems Manager
- The Docker container can pull images from ECR

> **Do this before installing Docker** — you will use SSM Session Manager (not SSH) to connect to the instance.

#### Create the IAM Role

1. Go to **IAM → Roles → Create role**
2. Trusted entity type: **AWS service**
3. Use case: **EC2**
4. Attach these two managed policies:

| Policy                                 | Why                                           |
|----------------------------------------|-----------------------------------------------|
| `AmazonSSMManagedInstanceCore`         | Allows SSM Agent to register and receive commands |
| `AmazonEC2ContainerRegistryReadOnly`   | Allows EC2 to pull images from ECR and call `aws ecr get-login-password` |

5. Name the role: `ec2-ssm-ecr-role`
6. Create the role

#### Attach the Role to the EC2

1. Go to your EC2 instance
2. **Actions → Security → Modify IAM role**
3. Select `ec2-ssm-ecr-role` → Save

#### Wait for SSM Registration

Wait 2–3 minutes, then check:

**Systems Manager → Fleet Manager → Managed Nodes**

Your instance should appear here.

**Deliverable:** EC2 visible as a Managed Node in Fleet Manager.

---

### Task 4 — Install Docker and AWS CLI via SSM Session Manager

Now that the EC2 has an SSM role, connect to it **without SSH** using SSM Session Manager.

#### Connect via Session Manager

1. Go to **Systems Manager → Session Manager**
2. Click **Start session**
3. Select your EC2 instance
4. Click **Start session** — a terminal opens in your browser

#### Install Docker

```bash
sudo apt-get update -y
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
docker --version
```

#### Install AWS CLI

The deployment script runs `aws ecr get-login-password` on the EC2. AWS CLI is not pre-installed on Ubuntu 22.04 — install it now:

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
sudo apt-get install -y unzip
unzip /tmp/awscliv2.zip -d /tmp
sudo /tmp/aws/install
aws --version
```

#### Verify

```bash
docker --version
aws --version
```

**Deliverable:** Both `docker --version` and `aws --version` return version output.

---

### Task 5 — Create a Target Group

1. Go to **EC2 → Target Groups → Create target group**
2. Target type: **Instances**
3. Name: `student-api-tg`
4. Protocol: **HTTP**
5. Port: **3000**
6. Health check path: `/health`
7. Click **Next** → select your EC2 → **Include as pending below** → **Create target group**

**Deliverable:** Target group created with EC2 registered as a target (status: pending or healthy).

---

### Task 6 — Create the Application Load Balancer

1. Go to **EC2 → Load Balancers → Create load balancer**
2. Choose **Application Load Balancer**
3. Name: `student-api-alb`
4. Scheme: **Internet-facing**
5. IP address type: **IPv4**
6. Network mapping: select **at least 2 Availability Zones** with public subnets
7. Security group: **`alb-sg`** (remove the default)
8. Listener: **HTTP :80 → Forward to `student-api-tg`**
9. Create load balancer

After creation, copy the **DNS name** shown in the ALB details.

> Example: `student-api-alb-123456789.us-east-1.elb.amazonaws.com`

Add this as the `ALB_DNS_NAME` secret in your GitHub repository.

**Deliverable:** ALB in "Active" state. DNS name saved as a repository secret.

---

## Part B — OIDC (Keyless AWS Authentication)

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

Create a new IAM Role:
- Trusted entity: **Web identity**
- Identity provider: `token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

After creation, edit the trust policy to scope it to your specific repository:

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

Attach the following inline policy. This grants only what the CI/CD pipeline needs:

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

**Deliverable:** Copy the Role ARN → add it as the `AWS_ROLE_ARN` secret in your GitHub repository.

---

## Part C — Local Docker Build

### Task 8 — Build and Test the Container

1. Copy `express-api/` into your repository and install dependencies:

   ```bash
   cd express-api
   npm install
   ```

   > **Important:** commit the generated `package-lock.json`. The Dockerfile uses `npm ci` which requires it. Without this file the Docker build will fail.

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

## Part D — GitHub Actions CI

### Task 9 — CI Pipeline

Create `.github/workflows/ci.yml` in your repository.

The pipeline:

```
Lint
  ↓
Build Docker Image   (local only — no push yet)
```

Requirements:
- Trigger: `push` to `main` and `pull_request` to `main`
- `lint` job: run `npm install` and `npm run lint` inside `express-api/`
- `build` job: depends on `lint`, builds the image with `docker build -t ... ./express-api`

**Deliverable:** Green CI workflow run in the Actions tab.

---

## Part E — Push to ECR

### Task 10 — Authenticate and Push

Update your workflow to authenticate to AWS via OIDC and push the image to ECR.

**Required top-level permissions block** (OIDC will not work without this):

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

The `ecr-login` action outputs `registry` — the ECR registry URL (e.g. `123456789.dkr.ecr.us-east-1.amazonaws.com`). You will need this value in the deploy job.

**Push the image with two tags:**
- `latest` — convenient for humans
- `${{ github.sha }}` — immutable, ties the image to an exact commit

**Deliverable:** After a push to `main`, the ECR repository shows both image tags.

---

## Part F — Deployment

### Task 11 — Deploy via SSM

Add a `deploy` job that runs after the image is pushed.

The job uses `aws ssm send-command` to remotely execute a deployment script on the EC2 — no SSH required.

#### Commands the EC2 must run, in order:

```bash
# 1 — Authenticate Docker to ECR using the EC2's IAM role credentials
aws ecr get-login-password --region <REGION> \
  | docker login --username AWS --password-stdin <ECR_REGISTRY>

# 2 — Pull the new image
docker pull <IMAGE>

# 3 — Stop and remove the old container (ignore error if it doesn't exist yet)
docker stop student-api 2>/dev/null || true
docker rm   student-api 2>/dev/null || true

# 4 — Start the new container on port 3000 (ALB target group forwards here)
docker run -d \
  --name student-api \
  --restart unless-stopped \
  -p 3000:3000 \
  <IMAGE>
```

> **Port note:** The container binds to port 3000. The ALB target group was configured to forward to port 3000. Do **not** use `-p 80:3000`.

#### Building the SSM parameters safely with `jq`

The `--parameters` flag for `aws ssm send-command` expects a JSON object. Use `jq` (pre-installed on GitHub Actions runners) to build it cleanly without shell quoting issues:

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

COMMAND_ID=$(aws ssm send-command \
  --instance-ids  "${{ secrets.EC2_INSTANCE_ID }}" \
  --document-name "AWS-RunShellScript" \
  --parameters    "$PARAMS" \
  --query         "Command.CommandId" \
  --output        text)

echo "command-id=$COMMAND_ID" >> $GITHUB_OUTPUT
```

#### Wait for the command to complete

```bash
aws ssm wait command-executed \
  --command-id  "$COMMAND_ID" \
  --instance-id "${{ secrets.EC2_INSTANCE_ID }}"
```

> **Note:** The `aws ssm wait command-executed` waiter polls every 5 seconds for up to 100 seconds. For a first deployment (fresh ECR image pull), this is usually enough. If your image is large, consider implementing a custom polling loop instead.

**Deliverable:** Workflow completes without errors. All 5 Docker steps succeed in the SSM command output.

---

## Part G — Health Validation

### Task 12 — Automated Health Check via ALB

After deployment, add a step that polls the `/health` endpoint **through the ALB**. This confirms the ALB successfully routes traffic to the new container.

> Note: After the container starts, the ALB health checker needs to run 2 successful checks (default interval: 30s each) before marking the target healthy and routing traffic. Expect up to 90 seconds before the first successful response.

Requirements:
- Poll `http://<ALB_DNS_NAME>/health`
- Retry at least 12 times with 10-second intervals (gives the ALB ~2 minutes to become healthy)
- Exit `0` on the first `200 OK`
- Exit `1` if all attempts fail
- On success, print the full ALB URL

**Deliverable:** The pipeline log ends with:

```
Health check passed on attempt N
Application is live at: http://<alb-dns-name>.elb.amazonaws.com
```

---

## Bonus Tasks

### Bonus 1 — Real `/version` Endpoint

Make `/version` return the actual commit SHA by passing it as a Docker build argument:

```bash
docker build --build-arg COMMIT_SHA="${{ github.sha }}" ...
```

The `Dockerfile` already accepts `ARG COMMIT_SHA=local` and sets `ENV COMMIT_SHA`. The route already reads `process.env.COMMIT_SHA`.

**Deliverable:** `GET /version` returns the real 40-character commit SHA.

---

### Bonus 2 — Parallel Jobs

Add a `test` job that runs **in parallel with `lint`**. Both must succeed before `build-and-push` starts:

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
        │  push event triggers workflow
        ▼
  GitHub Actions Runner
        │
        ├─── lint
        │
        ├─── OIDC → AssumeRole → AWS   (no static credentials)
        │              │
        │              ├── docker build --build-arg COMMIT_SHA=...
        │              ├── docker push :sha
        │              └── docker push :latest  ──────────▶  ECR
        │
        ├─── aws ssm send-command
        │              │
        │              ▼
        │         EC2 Instance  (SSM Agent receives command, runs as root)
        │              │
        │              ├── aws ecr get-login-password | docker login
        │              ├── docker pull  (new image from ECR)
        │              ├── docker stop  (old container)
        │              ├── docker rm    (old container)
        │              └── docker run -p 3000:3000  (new container)
        │
        └─── health check loop
                    │
                    │  HTTP GET /health (retries every 10s, up to 2 min)
                    ▼
        Application Load Balancer  (:80, alb-sg)
                    │
                    │  forwards to :3000 (ec2-sg allows only from alb-sg)
                    ▼
               EC2 Docker Container  (Express API)

Final URL: http://<alb-dns-name>.us-east-1.elb.amazonaws.com
```

---

## Security Model

| Component              | Reachable from internet | How                         |
|------------------------|-------------------------|-----------------------------|
| ALB port 80            | Yes                     | `alb-sg` allows `0.0.0.0/0` |
| EC2 port 3000          | No                      | `ec2-sg` allows only `alb-sg` |
| EC2 port 22 (SSH)      | No                      | No inbound rule, no key pair |
| EC2 management         | Via SSM Session Manager | SSM Agent → outbound HTTPS to AWS |
| GitHub → AWS auth      | Via OIDC               | No static keys stored anywhere |

---

## Concepts Covered

| Topic                      | What You Practiced                                                |
|----------------------------|-------------------------------------------------------------------|
| GitHub Actions             | Multi-job CI/CD pipeline with job dependencies                    |
| OIDC                       | Passwordless AWS authentication — no keys in GitHub              |
| IAM Trust Policy           | Scoping which repository and branch can assume the role           |
| Docker                     | Build, tag with two strategies, and push to a registry            |
| ECR                        | AWS-managed private Docker registry                               |
| EC2                        | Running a container on a real Linux server                        |
| Security Groups            | Network-layer isolation — ALB accepts internet, EC2 accepts ALB  |
| Application Load Balancer  | DNS-named entry point with built-in health awareness             |
| Target Groups              | Mapping ALB listener to container port 3000                       |
| Systems Manager            | Remote command execution and interactive sessions — no SSH        |
| AWS CLI on EC2             | ECR login from inside the instance using IAM role credentials    |
| Health Checks              | Pipeline waits for ALB to confirm the deployment is live          |
| Image Tagging              | `latest` for convenience, SHA tag for immutable traceability      |
