variable "github_org" {
  description = "GitHub org or username that owns FifaApp-backend and FifaApp-frontend"
  type        = string
}

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only workflows on the main branch of these two repos can assume the role.
    # PR builds never get AWS credentials.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_org}/FifaApp-backend:ref:refs/heads/main",
        "repo:${var.github_org}/FifaApp-frontend:ref:refs/heads/main",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "fifaapp-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role.json
  tags               = { Project = "FifaApp" }
}

# Same ECR push/pull policy the student IAM users got in Stage 6 — nothing more
resource "aws_iam_role_policy_attachment" "github_actions_ecr" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.ecr_access.arn
}

output "gha_role_arn" {
  description = "Set this as the AWS_ROLE_ARN secret in both app repos"
  value       = aws_iam_role.github_actions.arn
}
