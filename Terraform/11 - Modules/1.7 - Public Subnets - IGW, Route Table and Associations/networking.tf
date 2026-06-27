module "networking" {
  source = "./modules/networking"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "local-modules"
  }

  subnet_config = {
    # Private subnet (public defaults to false when omitted).
    subnet_1 = {
      cidr_block = "10.0.0.0/24"
      az         = "eu-west-1a"
    }

    # Public subnet — this single line triggers the IGW, public route table,
    # default route, and route-table association inside the module.
    subnet_2 = {
      cidr_block = "10.0.1.0/24"
      az         = "eu-west-1b"
      public     = true
    }
  }
}
