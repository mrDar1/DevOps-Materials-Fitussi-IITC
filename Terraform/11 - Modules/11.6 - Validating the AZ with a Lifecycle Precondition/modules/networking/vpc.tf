resource "aws_vpc" "this" {
  cidr_block = var.vpc_config.cidr_block

  tags = {
    Name = var.vpc_config.name
  }
}

# Real availability zones for the provider's region — used to validate the
# user-supplied subnet AZ below. (Its `id` attribute is the region name.)
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_subnet" "this" {
  for_each = var.subnet_config

  vpc_id            = aws_vpc.this.id
  availability_zone = each.value.az
  cidr_block        = each.value.cidr_block

  tags = {
    Name = "${var.vpc_config.name}-${each.key}"
  }

  # A `validation` block can't reach a data source, so we validate the AZ with
  # a lifecycle precondition. It composes the data source + each.value and
  # blocks `apply` at PLAN time with a user-friendly message.
  lifecycle {
    precondition {
      condition = contains(data.aws_availability_zones.available.names, each.value.az)
      # BEFORE (terse):  error_message = "Invalid AZ"
      error_message = <<-EOT
      The AZ ${each.value.az} provided for the subnet ${each.key} is invalid.
      The applied AWS region ${data.aws_availability_zones.available.id} supports the following AZs: ${join(", ", data.aws_availability_zones.available.names)}.
      EOT
    }
  }
}
