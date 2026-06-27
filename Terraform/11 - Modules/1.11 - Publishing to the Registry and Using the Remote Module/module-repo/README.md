# Networking Module

This module manages the creation of VPCs and subnets, allowing for the creation
of both private and public subnets.

## Example Usage

```hcl
module "networking" {
  source = "<your-namespace>/networking-tf-course/aws"

  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "your-vpc"
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
  }
}
```
