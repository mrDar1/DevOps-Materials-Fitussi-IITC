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

resource "aws_instance" "tf_cloud" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.ec2_instance_type # value supplied by the Terraform Cloud workspace variable

  tags = {
    Name = "terraform-cloud"
  }
}
