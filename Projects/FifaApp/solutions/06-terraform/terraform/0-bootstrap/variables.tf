variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "suffix" {
  description = "Unique suffix for S3 bucket name (use your AWS account ID or initials)"
  type        = string
}
