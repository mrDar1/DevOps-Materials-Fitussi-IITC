# No defaults on purpose — both values are supplied as Terraform variables
# in the terraform-vcs workspace in Terraform Cloud.

variable "vpc_cidr" {
  type = string
}

# --- Added in the second push (the "add subnet" commit) ---
variable "subnet_cidr" {
  type = string
}
