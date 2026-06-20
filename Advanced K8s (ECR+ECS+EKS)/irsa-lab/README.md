# IRSA Lab — IAM Roles for Service Accounts (EKS)

Hands-on lab: let a Kubernetes pod access an AWS S3 bucket using IRSA — no AWS credentials baked into the container.

## Parts

| Part | File | What you do |
|------|------|-------------|
| 0 | [part-0-prerequisites.md](part-0-prerequisites.md) | Install tools, set env vars |
| 1 | [part-1-create-cluster.md](part-1-create-cluster.md) | Create EKS cluster |
| 2 | [part-2-oidc-provider.md](part-2-oidc-provider.md) | Associate OIDC provider with IAM |
| 3 | [part-3-s3-and-policy.md](part-3-s3-and-policy.md) | Create S3 bucket + IAM policy |
| 4 | [part-4-irsa-role-sa.md](part-4-irsa-role-sa.md) | Create IAM role + service account |
| 5 | [part-5-test-without-irsa.md](part-5-test-without-irsa.md) | Test pod WITHOUT IRSA (expect denied) |
| 6 | [part-6-test-with-irsa.md](part-6-test-with-irsa.md) | Test pod WITH IRSA (expect success) |
| 7 | [part-7-inspect-token.md](part-7-inspect-token.md) | Inspect the projected JWT token |
| 8 | [part-8-cleanup.md](part-8-cleanup.md) | Tear down all resources |

Run parts in order.
