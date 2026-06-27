output "module_vpc_id" {
  value = module.networking.vpc_id
}

output "module_public_subnets" {
  value = module.networking.public_subnets
}

output "module_private_subnets" {
  value = module.networking.private_subnets
}
