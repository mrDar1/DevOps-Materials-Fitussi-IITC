variable "vpc_config" {
  description = "The VPC configuration, more specifically the required CIDR block and the VPC name."
  type = object({
    cidr_block = string
    name       = string
  })

  validation {
    condition     = can(cidrnetmask(var.vpc_config.cidr_block))
    error_message = "The cidr_block config option must contain a valid CIDR block."
  }
}

variable "subnet_config" {
  description = <<-EOT
  Accepts a map of subnet configurations. Each subnet configuration should contain:
    - cidr_block: the CIDR block of the subnet.
    - public:     whether the subnet should be public or not. Defaults to false.
    - az:         the availability zone where to deploy this subnet.
  EOT
  type = map(object({
    cidr_block = string
    az         = string
    public     = optional(bool, false)
  }))

  validation {
    condition = alltrue([
      for config in values(var.subnet_config) : can(cidrnetmask(config.cidr_block))
    ])
    error_message = "The cidr_block config option must contain a valid CIDR block."
  }
}
