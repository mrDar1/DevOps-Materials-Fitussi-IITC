variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC."
  # No `default` => the user is REQUIRED to provide a value.

  # Validation runs at PLAN time, catching a bad CIDR early instead of waiting
  # for the AWS API to reject it during apply.
  #   cidrnetmask(...) errors if the string is not a valid CIDR.
  #   can(...)         turns that error into true/false for the condition.
  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "The variable vpc_cidr must contain a valid CIDR block."
  }

  # Without the validation block above, `terraform plan` would PASS even with a
  # bad CIDR, and the error would only surface later from the AWS API on apply:
  #
  # variable "vpc_cidr" {
  #   type        = string
  #   description = "The CIDR block for the VPC."
  # }
}
