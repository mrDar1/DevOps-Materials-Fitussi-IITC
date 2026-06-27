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
      public     = true
    }
    subnet_3 = {
      cidr_block = "10.0.2.0/24"
      az         = "eu-west-1c"
      public     = true
    }
    subnet_4 = {
      cidr_block = "10.0.3.0/24"
      az         = "eu-west-1a"
    }
  }
}
