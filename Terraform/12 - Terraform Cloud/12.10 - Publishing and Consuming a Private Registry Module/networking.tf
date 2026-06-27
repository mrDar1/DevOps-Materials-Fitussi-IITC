# --- BEFORE (labs 12.8 / 12.9): raw VPC + subnet resources ---
#
# resource "aws_vpc" "tf_cloud" {
#   cidr_block = var.vpc_cidr
#   tags = { Name = "terraform-cloud" }
# }
#
# resource "aws_subnet" "tf_cloud" {
#   vpc_id     = aws_vpc.tf_cloud.id
#   cidr_block = var.subnet_cidr
#   tags = { Name = "terraform-cloud" }
# }
#
# --- AFTER: consume the PRIVATE registry module + migrate state with moved blocks ---

# `source` points at the Terraform Cloud private registry (app.terraform.io).
# No `version`-vs-local-path confusion: this is the private registry address,
# org/module/provider. `terraform init` needs you authenticated to TFC.
module "networking_tf_course" {
  source  = "app.terraform.io/your-organization/networking-tf-course/aws"
  version = "0.1.1"

  vpc_config = {
    cidr_block = var.vpc_cidr
    name       = "terraform-cloud"
  }

  # Single subnet, reusing the existing CIDR and matching the AZ of the
  # already-created subnet so the apply shows no destructive change.
  subnet_config = {
    subnet_1 = {
      cidr_block = var.subnet_cidr
      az         = "eu-west-1a"
    }
  }
}

# Migrate the existing standalone VPC into the module's aws_vpc.this.
# CIDR + name match, so this is a state move with no infrastructure change.
moved {
  from = aws_vpc.tf_cloud
  to   = module.networking_tf_course.aws_vpc.this
}

# The subnet is trickier: inside the module aws_subnet.this is created with
# for_each, so the target must carry the correct key — subnet_1.
moved {
  from = aws_subnet.tf_cloud
  to   = module.networking_tf_course.aws_subnet.this["subnet_1"]
}
