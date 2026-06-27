locals {
  project_name = "local-modules"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-*-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "this" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t2.micro" # or t3.micro, whichever is free-tier in your region

  # Reference the module's PRIVATE subnet output by the user's key.
  # NOTE: the attribute is `subnet_id` (not `id`) — see the module outputs.
  subnet_id = module.networking.private_subnets["subnet_1"].subnet_id

  tags = {
    Name = local.project_name
  }
}
