module "networking" {
  source = "./modules/networking"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "local-modules"
  }

  # A map of subnet objects — the user can declare as many as they want.
  # Keys use underscores (a dash would need quotes).
  subnet_config = {
    subnet_1 = {
      cidr_block = "10.0.0.0/24"
      az         = "eu-west-1a"
    }

    # Adding another subnet is now trivial — just another map entry.
    # `terraform plan` then shows 2 resources to add.
    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-west-1b"
    }

    # Experiment: an invalid cidr_block makes `terraform plan` fail with the
    # alltrue validation — "The cidr_block config option must contain a valid
    # CIDR block."
    # subnet_bad = {
    #   cidr_block = "300.0.0.0/24"
    #   az         = "eu-west-1a"
    # }
  }
}
