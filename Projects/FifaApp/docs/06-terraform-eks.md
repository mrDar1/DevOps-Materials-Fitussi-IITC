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

```bash
cd FifaApp-infra/terraform
terraform init        # connects to TFC, downloads providers
terraform plan
terraform apply
```

This takes ~15 minutes (EKS cluster creation). State is automatically stored in Terraform Cloud.

---

## Step 4 — Configure kubectl

```bash
$(terraform output -raw configure_kubectl)
kubectl get nodes   # verify connection
```

## Step 4b — Install the AWS Load Balancer Controller via Helm

The ALB Controller Helm chart is installed separately (not via Terraform) because the EKS cluster takes ~15 minutes to create, which exhausts the 15-minute STS token that Terraform uses to authenticate to Kubernetes in TFC remote runs.

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

CLUSTER_NAME=$(cd FifaApp-infra/terraform && terraform output -raw cluster_name)
VPC_ID=$(cd FifaApp-infra/terraform && terraform output -raw vpc_id)
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

## Step 5 — Push images to ECR

```bash
ECR_REGISTRY=$(terraform output -raw ecr_registry)
FRONTEND_URI=$(terraform output -raw ecr_frontend_uri)
BACKEND_URI=$(terraform output -raw ecr_backend_uri)
REGION=us-east-1

# Authenticate Docker to ECR
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push
docker build -t $FRONTEND_URI:latest ./FifaApp-frontend
docker push $FRONTEND_URI:latest

docker build -t $BACKEND_URI:latest ./FifaApp-backend
docker push $BACKEND_URI:latest
```

---

## Step 6 — Update K8s manifests for EKS

Two changes from Stage 5:

1. **Update image references** in `k8s/backend/deployment.yaml` and `k8s/frontend/deployment.yaml`:
   ```yaml
   image: <ECR_URI>:latest
   imagePullPolicy: Always   # was Never
   ```

2. **Change frontend Service type** from `NodePort` to `ClusterIP` (ALB handles external access now):
   ```yaml
   spec:
     type: ClusterIP
     # remove the nodePort line
   ```

---

## Step 7 — Apply manifests and ingress

Copy the ingress from `FifaApp-infra/k8s/ingress.yaml` into your `k8s/` directory, then apply:

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

`providers.tf` uses `aws_eks_cluster_auth` (data source token) instead of `exec` blocks, so everything runs on TFC's servers without needing a local `aws` CLI.

#### Bootstrap sequence (one-time setup)

The chicken-and-egg problem: you need AWS credentials to create the OIDC provider, but OIDC is what replaces those credentials. Solve it in two steps:

**Step 1 — first apply with static credentials (local execution)**

Set your AWS credentials locally and apply once:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

cd FifaApp-infra/terraform
terraform init
terraform apply -var="tfc_organization=lironefitoussi"
```

Copy the `tfc_role_arn` from the output.

**Step 2 — switch the workspace to OIDC (remote execution)**

In the TFC workspace (Settings → General):
- Set **Execution Mode → Remote**
- Add two **Environment Variables**:
  - `TFC_AWS_PROVIDER_AUTH` = `true`
  - `TFC_AWS_RUN_ROLE_ARN` = `<tfc_role_arn from output>`

From now on, TFC gets fresh temporary AWS credentials for every run — no static keys stored anywhere.

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
- An IAM user with a one-time password (retrieve with `terraform output -json student_passwords | jq`)
- EKS admin access (can `kubectl apply`)
- ECR push/pull access to both repos

---

## Teardown (to avoid AWS costs)

```bash
kubectl delete -R -f k8s/   # remove K8s resources (releases the ALB first)
cd FifaApp-infra/terraform
terraform destroy
```

---

## Stuck? Check the solution
```
solutions/06-terraform/terraform/
```
