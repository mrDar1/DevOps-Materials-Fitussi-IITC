# EKS Pod Identity — the modern replacement for IRSA (IAM Roles for Service Accounts).
#
# Key difference from IRSA:
#   - IRSA: relies on an OIDC provider + ServiceAccount annotation
#   - Pod Identity: uses aws_eks_pod_identity_association to bind a role directly to
#     a namespace/ServiceAccount pair. No OIDC provider needed. Simpler and more scalable.
#
# The eks-pod-identity-agent addon (enabled in eks.tf) handles the credential injection.

resource "aws_iam_policy" "alb_controller" {
  name        = "${var.cluster_name}-alb-controller-policy"
  description = "IAM policy for the AWS Load Balancer Controller"
  policy      = file("${path.module}/alb-controller-policy.json")
}

resource "aws_iam_role" "alb_controller" {
  name = "${var.cluster_name}-alb-controller"

  # pods.eks.amazonaws.com is the service principal for EKS Pod Identity.
  # This is the key difference vs. IRSA (which uses oidc.eks.amazonaws.com).
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "pods.eks.amazonaws.com"
        }
        Action = [
          "sts:AssumeRole",
          "sts:TagSession",
        ]
      }
    ]
  })

  tags = {
    Project = "FifaApp"
  }
}

resource "aws_iam_role_policy_attachment" "alb_controller" {
  role       = aws_iam_role.alb_controller.name
  policy_arn = aws_iam_policy.alb_controller.arn
}

# This binding tells EKS: "when a pod running under the 'aws-load-balancer-controller'
# ServiceAccount in the 'kube-system' namespace requests credentials, give it this role."
resource "aws_eks_pod_identity_association" "alb_controller" {
  cluster_name    = module.eks.cluster_name
  namespace       = "kube-system"
  service_account = "aws-load-balancer-controller"
  role_arn        = aws_iam_role.alb_controller.arn
}
