resource "aws_vpc" "this" {
  # BEFORE (primitives):  cidr_block = var.vpc_cidr
  cidr_block = var.vpc_config.cidr_block

  tags = {
    # BEFORE (primitives):  Name = var.vpc_name
    Name = var.vpc_config.name
  }
}
