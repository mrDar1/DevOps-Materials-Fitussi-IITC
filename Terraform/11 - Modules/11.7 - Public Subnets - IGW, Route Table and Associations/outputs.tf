# Re-expose the module's output so it prints at the root. A module output on
# its own isn't shown on the CLI — it's consumed by the caller.
output "module_public_subnets" {
  value = module.networking.public_subnets
}
