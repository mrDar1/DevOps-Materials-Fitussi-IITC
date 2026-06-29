output "configure_kubectl" {
  description = "Run this command after apply to configure kubectl"
  value       = "aws eks update-kubeconfig --name ${var.cluster_name} --region ${var.region}"
}

output "ecr_frontend_uri" {
  description = "ECR URI for the frontend image"
  value       = aws_ecr_repository.frontend.repository_url
}

output "ecr_backend_uri" {
  description = "ECR URI for the backend image"
  value       = aws_ecr_repository.backend.repository_url
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "ecr_registry" {
  description = "ECR registry base URL — use this for 'docker login'"
  value       = split("/", aws_ecr_repository.frontend.repository_url)[0]
}
