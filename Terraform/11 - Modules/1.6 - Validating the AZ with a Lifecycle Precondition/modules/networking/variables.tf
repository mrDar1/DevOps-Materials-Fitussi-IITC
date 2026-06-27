variable "vpc_config" {
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
  type = map(object({
    cidr_block = string
    az         = string
  }))

  # Validate every subnet's cidr_block (alltrue over the collection).
  validation {
    condition = alltrue([
      for config in values(var.subnet_config) : can(cidrnetmask(config.cidr_block))
    ])
    error_message = "The cidr_block config option must contain a valid CIDR block."
  }

  # NOTE: the AZ is NOT validated here. A `validation` block can't reference a
  # data source (the region's real AZ list), so AZ validation lives as a
  # lifecycle precondition on aws_subnet in vpc.tf.
}
