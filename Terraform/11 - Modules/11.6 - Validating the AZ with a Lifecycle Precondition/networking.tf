module "networking" {
  source = "./modules/networking"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "local-modules"
  }

  subnet_config = {
    subnet_1 = {
      cidr_block = "10.0.0.0/24"
      az         = "eu-west-1a"
    }

    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-west-1b"

      # Experiment: an AZ outside the provider region (e.g. "eu-central-1b")
      # PASSES `terraform plan` without the precondition, then FAILS `apply`
      # with an AWS InvalidParameter error. WITH the precondition (see the
      # module's vpc.tf) it fails at plan time with a clear, multi-line message:
      #   The AZ eu-central-1b provided for the subnet subnet_2 is invalid.
      #   The applied AWS region eu-west-1 supports the following AZs: ...
      # az = "eu-central-1b"
    }
  }
}
