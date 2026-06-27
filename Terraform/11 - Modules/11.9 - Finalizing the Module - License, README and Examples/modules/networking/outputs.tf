output "vpc_id" {
  value       = aws_vpc.this.id
  description = "The AWS ID from the created VPC."
}

output "public_subnets" {
  value       = local.output_public_subnets
  description = "The ID and availability zone of public subnets."
}

output "private_subnets" {
  value       = local.output_private_subnets
  description = "The ID and availability zone of private subnets."
}
