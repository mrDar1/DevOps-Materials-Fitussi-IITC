output "tfstate_bucket_name" {
  description = "S3 bucket name to paste into backend.tf"
  value       = aws_s3_bucket.tfstate.bucket
}
