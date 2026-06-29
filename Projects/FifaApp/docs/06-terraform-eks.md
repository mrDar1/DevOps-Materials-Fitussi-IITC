# Stage 6 — Terraform + EKS

## Goal
Provision production-grade AWS infrastructure with Terraform and deploy the app to EKS.  
You'll create a VPC, EKS cluster, ECR repositories, student IAM users, and wire up the AWS Load Balancer Controller using **EKS Pod Identity** (the modern replacement for IRSA).

State is stored in **Terraform Cloud** — no S3 bucket or bootstrap step needed.

---

## What you're building

```
AWS Account
├── VPC (3 AZs, public + private subnets, NAT Gateway)
├── EKS cluster (fifaapp-eks, Kubernetes 1.31)
│   ├── Managed node group (t3.medium × 2)
│   └── Add-ons: coredns, kube-proxy, vpc-cni, eks-pod-identity-agent
├── ECR repos (fifaapp-frontend, fifaapp-backend)
├── IAM users (one per student, configured in students.yaml)
└── AWS Load Balancer Controller (via Helm, authenticated via Pod Identity)
```

---

## Directory structure

```
FifaApp-infra/
├── terraform/    ← all Terraform code
└── k8s/          ← ingress manifest (added in this stage)
```

---

## Step 0 — Create the FifaApp-infra repository

Create the repo structure locally and write the Terraform files below. For the three boilerplate files (`variables.tf`, `outputs.tf`, `alb-controller-policy.json`) copy them from `solutions/06-terraform/terraform/` — they're pure declarations with no real decisions.

```bash
mkdir -p ~/DevOps/FifaApp-infra/terraform ~/DevOps/FifaApp-infra/k8s
cd ~/DevOps/FifaApp-infra
git init
```

### terraform/providers.tf

Declares the AWS provider and minimum Terraform version.

```hcl
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.region
}
```

### terraform/backend.tf

Connects Terraform to HCP Terraform for remote state. You'll fill in `YOUR_TFC_ORG` in Step 1.

```hcl
terraform {
  cloud {
    organization = "YOUR_TFC_ORG"

    workspaces {
      name = "fifaapp-eks"
    }
  }
}
```

### terraform/vpc.tf

A 3-AZ VPC with public and private subnets. The subnet **tags are mandatory** — the ALB Controller reads them to decide which subnets to place load balancers in.

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "fifaapp-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.region}a", "${var.region}b", "${var.region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }

  tags = { Project = "FifaApp" }
}
```

### terraform/eks.tf

The EKS cluster. Key settings to understand:
- `eks-pod-identity-agent` addon — required for Pod Identity (used by the ALB Controller in `pod-identity.tf`)
- `enable_cluster_creator_admin_permissions` — grants your IAM user cluster-admin access automatically, no `aws-auth` ConfigMap editing needed
- `enable_irsa` — creates the OIDC provider for the cluster, needed if any workload uses IRSA

```hcl
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    default = {
      instance_types = [var.node_instance_type]
      min_size       = 1
      max_size       = 4
      desired_size   = var.desired_nodes
    }
  }

  cluster_addons = {
    coredns                = {}
    kube-proxy             = {}
    vpc-cni                = {}
    eks-pod-identity-agent = {}
  }

  enable_cluster_creator_admin_permissions = true
  enable_irsa                              = true

  tags = { Project = "FifaApp" }
}
```

### terraform/ecr.tf

Two private ECR repositories. `force_delete = true` lets `terraform destroy` remove them even when they contain images — without it, destroy fails.

```hcl
resource "aws_ecr_repository" "frontend" {
  name                 = "fifaapp-frontend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Project = "FifaApp" }
}

resource "aws_ecr_repository" "backend" {
  name                 = "fifaapp-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Project = "FifaApp" }
}
```

### terraform/students.yaml

You'll edit this in Step 2. Create it now with placeholder entries:

```yaml
students:
  - username: student-01
  - username: student-02
  - username: student-03
```

### terraform/iam-users.tf

Creates one IAM user per entry in `students.yaml`. Two patterns worth noting:
- `yamldecode(file(...))` reads the YAML at plan time — adding a student means a one-line YAML edit, no Terraform code changes
- `aws_eks_access_entry` + `aws_eks_access_policy_association` is the modern EKS access model, replacing the old `aws-auth` ConfigMap

```hcl
locals {
  students_config = yamldecode(file("${path.module}/students.yaml"))
  students_map    = { for s in local.students_config.students : s.username => s }
}

resource "aws_iam_user" "students" {
  for_each = local.students_map
  name     = each.value.username
  tags     = { Project = "FifaApp" }
}

resource "aws_iam_user_login_profile" "students" {
  for_each                = aws_iam_user.students
  user                    = each.value.name
  password_reset_required = true
  lifecycle { ignore_changes = all }
}

resource "aws_iam_group" "devops_students" {
  name = "fifaapp-devops-students"
}

resource "aws_iam_group_membership" "students" {
  name  = "fifaapp-students-membership"
  users = [for u in aws_iam_user.students : u.name]
  group = aws_iam_group.devops_students.name
}

resource "aws_eks_access_entry" "students" {
  for_each      = aws_iam_user.students
  cluster_name  = module.eks.cluster_name
  principal_arn = each.value.arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "students" {
  for_each      = aws_eks_access_entry.students
  cluster_name  = module.eks.cluster_name
  principal_arn = each.value.principal_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSAdminPolicy"

  access_scope {
    type = "cluster"
  }
}

resource "aws_iam_policy" "ecr_access" {
  name   = "fifaapp-ecr-access"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = [
          "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage", "ecr:PutImage", "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart", "ecr:CompleteLayerUpload",
        ]
        Resource = [aws_ecr_repository.frontend.arn, aws_ecr_repository.backend.arn]
      },
    ]
  })
}

resource "aws_iam_group_policy_attachment" "ecr_access" {
  group      = aws_iam_group.devops_students.name
  policy_arn = aws_iam_policy.ecr_access.arn
}

output "student_passwords" {
  description = "Initial passwords — distribute securely"
  value       = { for k, v in aws_iam_user_login_profile.students : k => v.password }
  sensitive   = true
}
```

### terraform/pod-identity.tf

Grants the ALB Controller permission to create load balancers. See the [EKS Pod Identity section](#eks-pod-identity--how-it-works) below for why this is simpler than IRSA.

```hcl
resource "aws_iam_policy" "alb_controller" {
  name   = "${var.cluster_name}-alb-controller-policy"
  policy = file("${path.module}/alb-controller-policy.json")
}

resource "aws_iam_role" "alb_controller" {
  name = "${var.cluster_name}-alb-controller"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "pods.eks.amazonaws.com" }
      Action    = ["sts:AssumeRole", "sts:TagSession"]
    }]
  })

  tags = { Project = "FifaApp" }
}

resource "aws_iam_role_policy_attachment" "alb_controller" {
  role       = aws_iam_role.alb_controller.name
  policy_arn = aws_iam_policy.alb_controller.arn
}

resource "aws_eks_pod_identity_association" "alb_controller" {
  cluster_name    = module.eks.cluster_name
  namespace       = "kube-system"
  service_account = "aws-load-balancer-controller"
  role_arn        = aws_iam_role.alb_controller.arn
}
```

### terraform/tfc-oidc.tf

Creates the OIDC trust between AWS and Terraform Cloud so TFC gets temporary credentials per run — no static access keys stored anywhere. See the [OIDC section](#oidc--two-providers-one-concept) below.

```hcl
data "tls_certificate" "tfc" {
  url = "https://app.terraform.io"
}

resource "aws_iam_openid_connect_provider" "tfc" {
  url             = "https://app.terraform.io"
  client_id_list  = ["aws.workload.identity"]
  thumbprint_list = [data.tls_certificate.tfc.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "tfc_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.tfc.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "app.terraform.io:aud"
      values   = ["aws.workload.identity"]
    }

    condition {
      test     = "StringLike"
      variable = "app.terraform.io:sub"
      values   = ["organization:${var.tfc_organization}:project:*:workspace:${var.tfc_workspace}:run_phase:*"]
    }
  }
}

resource "aws_iam_role" "tfc" {
  name               = "tfc-${var.tfc_workspace}-role"
  assume_role_policy = data.aws_iam_policy_document.tfc_assume_role.json
  tags               = { Project = "FifaApp" }
}

resource "aws_iam_role_policy_attachment" "tfc_admin" {
  role       = aws_iam_role.tfc.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "tfc_role_arn" {
  description = "Set this as TFC_AWS_RUN_ROLE_ARN in the TFC workspace env vars"
  value       = aws_iam_role.tfc.arn
}
```

### terraform/alb-controller.tf

This file contains only a comment explaining a design decision — no resources. Create it to document why the Helm install is in Step 4b rather than here:

```hcl
# The ALB Controller Helm chart is installed via CLI after the cluster is ready
# (Step 4b). Installing it here via the kubernetes provider would race against
# EKS cluster creation: the cluster takes ~15 min, which exhausts the 15-min
# STS token that TFC uses to authenticate to Kubernetes in remote runs.
#
# IAM role, policy, and Pod Identity association remain in pod-identity.tf.
```

### Boilerplate files — copy from solutions

Copy these three files verbatim from `solutions/06-terraform/terraform/`:
- **`variables.tf`** — input variable declarations (region, cluster name, node type, etc.)
- **`outputs.tf`** — exposes ECR URIs, cluster name, VPC ID, and the `configure_kubectl` command
- **`alb-controller-policy.json`** — the official AWS-published IAM policy for the ALB Controller (~400 lines)

### Push to GitHub

```bash
cd ~/DevOps/FifaApp-infra
echo ".terraform/" > .gitignore
echo "*.tfvars" >> .gitignore
git add .
git commit -m "Initial Terraform infrastructure"
gh repo create FifaApp-infra --public --source=. --remote=origin --push
```

Then connect the repo to your TFC workspace: **Settings → Version Control → Connect to VCS**.

---

## Prerequisites

### 1 — Terraform Cloud workspace

1. Sign up at [app.terraform.io](https://app.terraform.io) and create an organization
2. Create a new workspace named `fifaapp-eks`
3. Leave execution mode as **Remote** (default) — after the OIDC bootstrap below, TFC will run applies on its own servers with dynamic AWS credentials
4. Generate a TFC API token: User Settings → Tokens → Create API token

### 2 — Authenticate the Terraform CLI to TFC

```bash
terraform login
```

This opens a browser to generate a token and saves it to `~/.terraform.d/credentials.tfrc.json`.

### 3 — AWS credentials (bootstrap only)

You need static credentials for the **first apply only** (to create the OIDC trust). After that, TFC uses dynamic credentials.

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
aws sts get-caller-identity   # verify
```

---

## Step 1 — Configure the backend

In `FifaApp-infra/terraform/backend.tf`, replace `YOUR_TFC_ORG` with your Terraform Cloud organization name:

```hcl
terraform {
  cloud {
    organization = "YOUR_TFC_ORG"

    workspaces {
      name = "fifaapp-eks"
    }
  }
}
```

---

## Step 2 — Configure student usernames

Edit `FifaApp-infra/terraform/students.yaml`:

```yaml
students:
  - username: student-01
  - username: student-02
  - username: student-03
```

---

## Step 3 — Deploy the infrastructure

> **VCS-connected workspaces block CLI applies.** If your workspace is linked to GitHub, running `terraform apply` from the terminal will error with "Apply not allowed for workspaces with a VCS connection." Use one of these two approaches instead:
>
> **Option A (recommended) — push to git and let TFC trigger the run:**
> ```bash
> cd FifaApp-infra
> git add -A && git commit -m "Initial Terraform config" && git push
> ```
> Then go to **app.terraform.io → fifaapp-eks → Runs**, wait for the plan to finish, and click **Confirm & Apply**.
>
> **Option B — disconnect VCS temporarily for CLI apply:**
> In TFC workspace Settings → Version Control, remove the VCS connection. Then run:
> ```bash
> cd FifaApp-infra/terraform
> terraform init        # connects to TFC, downloads providers
> terraform apply -var="tfc_organization=<YOUR_TFC_ORG>"
> ```
> Reconnect VCS after the apply completes.

This takes ~15 minutes (EKS cluster creation). State is automatically stored in Terraform Cloud.

---

## Step 4 — Configure kubectl

```bash
cd ~/DevOps/FifaApp-infra/terraform
aws eks update-kubeconfig --name $(terraform output -raw cluster_name) --region us-east-1
kubectl get nodes   # verify connection
```

## Step 4b — Install the AWS Load Balancer Controller via Helm

The ALB Controller Helm chart is installed separately (not via Terraform) because the EKS cluster takes ~15 minutes to create, which exhausts the 15-minute STS token that Terraform uses to authenticate to Kubernetes in TFC remote runs.

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

CLUSTER_NAME=$(cd ~/DevOps/FifaApp-infra/terraform && terraform output -raw cluster_name)
VPC_ID=$(cd ~/DevOps/FifaApp-infra/terraform && terraform output -raw vpc_id)
REGION=us-east-1

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=$CLUSTER_NAME \
  --set serviceAccount.create=true \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=$REGION \
  --set vpcId=$VPC_ID \
  --version 1.7.2

kubectl rollout status deployment/aws-load-balancer-controller -n kube-system
```

> The IAM role and Pod Identity association are still managed by Terraform (`pod-identity.tf`) — only the Helm install moved to CLI.

---

## Step 4c — Allow EKS to reach MongoDB Atlas

Your backend pods connect to MongoDB Atlas through the **NAT Gateway**. MongoDB Atlas only allows connections from whitelisted IPs — you need to add the NAT Gateway's public IP.

Get the NAT Gateway IP:

```bash
kubectl run tmp-curl --image=curlimages/curl --restart=Never --rm -it -n fifaapp \
  -- curl -s ifconfig.me 2>/dev/null
```

Then in **MongoDB Atlas → Network Access → Add IP Address**, add that IP (or `0.0.0.0/0` to allow all — acceptable for a dev environment).

> If you tear down and rebuild the infrastructure, the NAT Gateway gets a **new IP** — repeat this step.

---

## Step 5 — Push images to ECR

```bash
cd ~/DevOps/FifaApp-infra/terraform
ECR_REGISTRY=$(terraform output -raw ecr_registry)
FRONTEND_URI=$(terraform output -raw ecr_frontend_uri)
BACKEND_URI=$(terraform output -raw ecr_backend_uri)
REGION=us-east-1

# Authenticate Docker to ECR
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push (run from the root of your FifaApp repo)
cd ~/DevOps/FifaApp
docker build -t $FRONTEND_URI:latest ./FifaApp-frontend
docker push $FRONTEND_URI:latest

docker build -t $BACKEND_URI:latest ./FifaApp-backend
docker push $BACKEND_URI:latest
```

---

## Step 6 — Update K8s manifests for EKS

Two changes from Stage 5:

1. **Update image references** in `k8s/backend/deployment.yaml` and `k8s/frontend/deployment.yaml`.  
   Get your ECR URIs first:
   ```bash
   cd ~/DevOps/FifaApp-infra/terraform
   terraform output ecr_frontend_uri
   terraform output ecr_backend_uri
   ```
   Then update both deployment files:
   ```yaml
   image: <ECR_URI>:latest      # e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/fifaapp-frontend:latest
   imagePullPolicy: Always      # was Never
   ```

2. **Change frontend Service type** from `NodePort` to `ClusterIP` (ALB handles external access now):
   ```yaml
   spec:
     type: ClusterIP
     ports:
       - port: 80
         targetPort: 80
         # remove the nodePort line
   ```

---

## Step 7 — Apply manifests and ingress

Copy the ingress from `FifaApp-infra/k8s/ingress.yaml` into your `k8s/` directory, then apply. It uses `spec.ingressClassName: alb` (the modern replacement for the deprecated `kubernetes.io/ingress.class` annotation).

```bash
cp FifaApp-infra/k8s/ingress.yaml k8s/ingress.yaml
kubectl apply -f k8s/namespace.yaml
kubectl apply -R -f k8s/

# Watch the ALB being provisioned (takes 2–3 minutes)
kubectl get ingress -n fifaapp -w
```

Once `ADDRESS` appears, open it in your browser.

---

## OIDC — two providers, one concept

### 1 — EKS OIDC provider (enables IRSA)

`eks.tf` sets `enable_irsa = true`. The EKS module creates an IAM OIDC Identity Provider for the cluster — the foundation for **IRSA** (IAM Roles for Service Accounts).

We use **Pod Identity** for the ALB controller (simpler, no annotation needed), but the OIDC provider is there for any workload that expects IRSA.

### 2 — Terraform Cloud OIDC Dynamic Credentials

`tfc-oidc.tf` creates:
- An **IAM OIDC Identity Provider** for `app.terraform.io` in your AWS account
- An **IAM role** (`tfc-fifaapp-eks-role`) that TFC can assume via `sts:AssumeRoleWithWebIdentity`
- The trust policy is **scoped to this workspace only** — no other TFC workspace can assume the role

`providers.tf` uses a standard `provider "aws"` block — TFC injects the credentials automatically via the OIDC role, so no `exec` blocks or local `aws` CLI are needed.

#### Bootstrap sequence (one-time setup)

There is a chicken-and-egg problem: you need AWS credentials to create the OIDC provider, but OIDC is what replaces those credentials.

The solution is Step 3 Option B — disconnect VCS temporarily and run the first apply locally with static credentials:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

cd ~/DevOps/FifaApp-infra/terraform
terraform init
terraform apply -var="tfc_organization=<YOUR_TFC_ORG>"
```

Once the apply completes, copy the `tfc_role_arn` output value, then set these two **Environment Variables** in the TFC workspace (Settings → Variables):
- `TFC_AWS_PROVIDER_AUTH` = `true`
- `TFC_AWS_RUN_ROLE_ARN` = `<tfc_role_arn from output>`

Reconnect VCS. From now on TFC gets fresh temporary AWS credentials for every run — no static keys stored anywhere.

---

## EKS Pod Identity — how it works

**IRSA (old way):**
- Requires an OIDC provider attached to the cluster
- ServiceAccount needs an `eks.amazonaws.com/role-arn` annotation
- Role trust policy references the OIDC issuer URL

**EKS Pod Identity (new way):**
- No OIDC provider needed
- `aws_eks_pod_identity_association` creates the binding directly:
  ```hcl
  resource "aws_eks_pod_identity_association" "alb_controller" {
    cluster_name    = module.eks.cluster_name
    namespace       = "kube-system"
    service_account = "aws-load-balancer-controller"
    role_arn        = aws_iam_role.alb_controller.arn
  }
  ```
- The `eks-pod-identity-agent` addon (running as a DaemonSet) intercepts credential requests from pods and injects temporary AWS credentials automatically

**Result:** The ALB Controller pod gets AWS permissions to create load balancers, with no annotations on the ServiceAccount and no OIDC configuration.

---

## Why Terraform Cloud instead of S3?

| | S3 backend | Terraform Cloud |
|--|--|--|
| Setup | Bootstrap step to create the bucket first | Sign up + `terraform login` |
| State locking | DynamoDB table required | Built-in |
| UI | None | Full run history, state viewer, cost estimates |
| Collaboration | Share bucket access | Team workspace with RBAC |

---

## What students get

After `terraform apply`, each student in `students.yaml` has:
- An IAM user with a one-time password (retrieve with `cd ~/DevOps/FifaApp-infra/terraform && terraform output -json student_passwords | jq`)
- EKS admin access (can `kubectl apply`)
- ECR push/pull access to both repos

---

## Teardown (to avoid AWS costs)

```bash
# 1. Remove K8s resources first — this releases the ALB before Terraform runs
kubectl delete -R -f k8s/

# 2. Destroy infrastructure
# Same VCS restriction applies as in Step 3.
# Option A — push a deletion commit if your CI/CD is wired up, OR
# Option B — disconnect VCS in TFC workspace settings first, then:
cd FifaApp-infra/terraform
terraform destroy
```

> **Note:** `terraform destroy` deletes ECR repositories including any images inside them (`force_delete = true` is set on both repos). No manual image cleanup needed.

---

## Stuck? Check the solution
```
solutions/06-terraform/terraform/
```
