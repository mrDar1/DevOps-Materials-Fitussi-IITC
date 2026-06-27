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

# A map of objects (not a single object) so the user can declare MULTIPLE
# subnets. The map key is a user-chosen label; the module doesn't care about it.
variable "subnet_config" {
  type = map(object({
    cidr_block = string
    az         = string
  }))

  # Validate EVERY subnet's cidr_block, not just one:
  #   values(...)            -> the list of subnet objects
  #   for ... : can(cidr...) -> a list of true/false, one per subnet
  #   alltrue([...])         -> true only if all CIDRs are valid
  validation {
    condition = alltrue([
      for config in values(var.subnet_config) : can(cidrnetmask(config.cidr_block))
    ])
    error_message = "The cidr_block config option must contain a valid CIDR block."
  }

  # NOTE: meaningful availability-zone validation needs a larger setup and is
  # added in a later lab. For now we just receive `az`.
}
