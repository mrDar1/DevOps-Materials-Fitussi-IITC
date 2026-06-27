resource "aws_vpc" "this" {
  cidr_block = var.vpc_config.cidr_block

  tags = {
    Name = var.vpc_config.name
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Filter the subnet map down to ONLY the public subnets. Drives the IGW,
# route table, and associations below.
locals {
  public_subnets = {
    for key, config in var.subnet_config : key => config if config.public
  }
}

resource "aws_subnet" "this" {
  for_each = var.subnet_config

  vpc_id            = aws_vpc.this.id
  availability_zone = each.value.az
  cidr_block        = each.value.cidr_block

  tags = {
    Name = "${var.vpc_config.name}-${each.key}"
  }

  lifecycle {
    precondition {
      condition     = contains(data.aws_availability_zones.available.names, each.value.az)
      error_message = <<-EOT
      The AZ ${each.value.az} provided for the subnet ${each.key} is invalid.
      The applied AWS region ${data.aws_availability_zones.available.id} supports the following AZs: ${join(", ", data.aws_availability_zones.available.names)}.
      EOT
    }
  }
}

# --- Public networking: created only when at least one subnet is public ---

# Exactly one internet gateway (the `> 0 ? 1 : 0` form, not raw length, so we
# never deploy more than one even with many public subnets).
resource "aws_internet_gateway" "this" {
  count = length(local.public_subnets) > 0 ? 1 : 0

  vpc_id = aws_vpc.this.id # required — without it, apply fails ("different networks")
}

resource "aws_route_table" "public_rtb" {
  count = length(local.public_subnets) > 0 ? 1 : 0

  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    # IGW uses count, so it must be indexed: [0]
    gateway_id = aws_internet_gateway.this[0].id
  }
}

resource "aws_route_table_association" "public" {
  for_each = local.public_subnets

  # aws_subnet uses for_each -> index by key
  subnet_id = aws_subnet.this[each.key].id
  # route table uses count -> index by [0]
  route_table_id = aws_route_table.public_rtb[0].id
}
