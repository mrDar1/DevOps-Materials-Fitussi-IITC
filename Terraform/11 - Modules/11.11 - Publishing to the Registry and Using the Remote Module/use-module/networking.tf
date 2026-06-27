# Consuming the REMOTE module from the Terraform Registry.
#
# Replace <your-namespace> with your registry namespace (GitHub user/org).
# `source` is the registry address (namespace/name/provider), NOT a local path.
# `terraform init` downloads it from the registry; pin the published `version`.
module "networking" {
  source  = "<your-namespace>/networking-tf-course/aws"
  version = "0.1.1"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "remote-module"
  }

  # Two subnets: one private, one public.
  subnet_config = {
    subnet_1 = {
      cidr_block = "10.0.0.0/24"
      az         = "eu-west-1a"
    }
    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-west-1b"
      public     = true
    }
  }
}
