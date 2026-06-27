locals {
  project_name = "public-modules"
  common_tags = {
    Project   = local.project_name
    ManagedBy = "Terraform"
  }
}
