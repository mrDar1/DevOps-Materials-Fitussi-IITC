# --- BEFORE: two separate top-level primitives -----------------------------
# Works, but two arguments that both describe VPC configuration is a smell.
#
# variable "vpc_cidr" {
#   type        = string
#   description = "The CIDR block for the VPC."
#
#   validation {
#     condition     = can(cidrnetmask(var.vpc_cidr))
#     error_message = "The variable vpc_cidr must contain a valid CIDR block."
#   }
# }
#
# variable "vpc_name" {
#   type = string
# }
# ---------------------------------------------------------------------------

# --- AFTER: group related inputs under one object --------------------------
# Prefer object attributes over a pile of top-level primitives. Easier to
# extend later, and groups inputs logically by the part of the module they
# touch.
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
