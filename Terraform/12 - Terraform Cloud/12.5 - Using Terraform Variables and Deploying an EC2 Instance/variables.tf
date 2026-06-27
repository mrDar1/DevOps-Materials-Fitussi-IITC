variable "ec2_instance_type" {
  type = string

  # No default on purpose — the value comes from a *Terraform variable*
  # defined in the Terraform Cloud workspace (key: ec2_instance_type).

  validation {
    condition     = var.ec2_instance_type == "t2.micro"
    error_message = "Please use t2.micro to stay within the free tier."
  }
}
