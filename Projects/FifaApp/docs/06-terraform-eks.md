# Stage 6 — Terraform + EKS

## Goal
Provision production-grade AWS infrastructure with Terraform and deploy the app to EKS.  
You'll create a VPC, EKS cluster, ECR repositories, student IAM users, and wire up the AWS Load Balancer Controller using **EKS Pod Identity** (the modern replacement for IRSA).

---

## What you're building

```
AWS Account
├── S3 bucket (Terraform remote state)
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

The Terraform code lives in the `FifaApp-infra` repo. Create it and initialize it:

```
FifaApp-infra/
├── 0-bootstrap/    ← run first, with local state
└── infra/          ← main infrastructure, uses S3 backend
```

---

## Step 0 — Bootstrap the S3 backend

The first time you run Terraform, there's no S3 bucket for state yet. The bootstrap creates it.

```bash
cd FifaApp-infra/0-bootstrap
terraform init
terraform apply -var="suffix=<your-account-id>"
```

Copy the output `tfstate_bucket_name` — you'll need it in the next step.

---

## Step 1 — Configure the backend

In `FifaApp-infra/infra/backend.tf`, replace the placeholder:

```hcl
terraform {
  backend "s3" {
    bucket = "fifaapp-tfstate-<YOUR_SUFFIX>"   # ← paste here
    key    = "eks/terraform.tfstate"
    region = "us-east-1"
  }
}
```

---

## Step 2 — Configure student usernames

Edit `students.yaml`:

```yaml
students:
  - username: student-01
  - username: student-02
  - username: student-03
```

---

## Step 3 — Deploy the infrastructure

```bash
cd FifaApp-infra/infra
terraform init
terraform plan
terraform apply
```

This takes ~15 minutes (EKS cluster creation).

---

## Step 4 — Configure kubectl

```bash
$(terraform output -raw configure_kubectl)
kubectl get nodes  # verify connection
```

---

## Step 5 — Push images to ECR

```bash
ECR_REGISTRY=$(terraform output -raw ecr_registry)   # e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com
FRONTEND_URI=$(terraform output -raw ecr_frontend_uri)
BACKEND_URI=$(terraform output -raw ecr_backend_uri)
REGION=us-east-1

# Authenticate Docker to the ECR registry (one login covers all repos in the account)
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push frontend
docker build -t $FRONTEND_URI:latest ./FifaApp-frontend
docker push $FRONTEND_URI:latest

# Build and push backend
docker build -t $BACKEND_URI:latest ./FifaApp-backend
docker push $BACKEND_URI:latest
```

---

## Step 6 — Update K8s manifests for EKS

Two changes from Stage 5:

1. **Update image references** in `k8s/backend/deployment.yaml` and `k8s/frontend/deployment.yaml`:
   ```yaml
   image: <ECR_URI>:latest
   imagePullPolicy: Always  # change from Never
   ```

2. **Change frontend Service type** from `NodePort` to `ClusterIP` (ALB handles external access now):
   ```yaml
   type: ClusterIP
   # remove nodePort line
   ```

---

## Step 7 — Apply manifests and ingress

First, add the ALB ingress to your `k8s/` directory. You can copy it from the solutions folder:

```bash
cp solutions/06-terraform/k8s/ingress.yaml k8s/ingress.yaml
```

Or create it manually:

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fifaapp-ingress
  namespace: fifaapp
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
spec:
  rules:
    - http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: fifaapp-backend-svc
                port:
                  number: 8000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: fifaapp-frontend-svc
                port:
                  number: 80
```

Then apply everything:

```bash
kubectl apply -R -f k8s/

# Watch the ALB being provisioned (takes 2–3 minutes)
kubectl get ingress -n fifaapp -w
```

Once `ADDRESS` appears in the ingress output, open it in your browser.

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

## What students get

After `terraform apply`, each student in `students.yaml` has:
- An IAM user with a one-time password (retrieve with `terraform output -json student_passwords | jq`)
- EKS admin access (can `kubectl apply`)
- ECR push/pull access to both repos

---

## Teardown (to avoid AWS costs)

```bash
kubectl delete -R -f k8s/       # remove K8s resources (ALB etc.)
terraform destroy                # destroy all AWS infra
```

---

## Stuck? Check the solution
```
solutions/06-terraform/terraform/
```
