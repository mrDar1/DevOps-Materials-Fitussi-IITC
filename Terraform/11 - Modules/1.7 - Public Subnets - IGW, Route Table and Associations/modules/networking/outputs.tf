# Temporary output used to inspect the public-subnet filter. The root module
# re-exposes it so it prints on the CLI. (Replaced with useful outputs later.)
output "public_subnets" {
  value = local.public_subnets
}
