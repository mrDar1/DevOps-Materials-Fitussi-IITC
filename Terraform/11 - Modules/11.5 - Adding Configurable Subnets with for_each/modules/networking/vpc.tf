resource "aws_vpc" "this" {
  cidr_block = var.vpc_config.cidr_block

  tags = {
    Name = var.vpc_config.name
  }
}

# One subnet per entry in var.subnet_config.
#   each.key   -> the map key (e.g. "subnet_1")
#   each.value -> the subnet object ({ cidr_block, az })
resource "aws_subnet" "this" {
  for_each = var.subnet_config

  vpc_id            = aws_vpc.this.id # wired to this module's VPC — user never sets it
  availability_zone = each.value.az
  cidr_block        = each.value.cidr_block

  tags = {
    Name = "${var.vpc_config.name}-${each.key}"
  }
}
