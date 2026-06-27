# The module label ("networking") does NOT need to match the module folder name.
# It could just as well be:
#
# module "vpc" {
#   source = "./modules/networking"
#   ...
# }

module "networking" {
  # Local source: a relative path to the module folder.
  source = "./modules/networking"

  # Experiment 1 — invalid CIDR: `terraform plan` fails at plan time with the
  # validation error "The variable vpc_cidr must contain a valid CIDR block."
  # (Remember: a newly added module must be installed first via `terraform init`.)
  # vpc_cidr = "not-a-cidr"

  # Final — valid CIDR: plan succeeds. No changes yet, because the module
  # defines no resources in main.tf so far (those come in the next lab).
  vpc_cidr = "10.0.0.0/16"
}

# Aside: if you comment out the whole `module` block above and run
# `terraform plan`, you get "No changes" — Terraform only looks at the root
# directory. Code under modules/ does nothing until it is *called* as a module.
