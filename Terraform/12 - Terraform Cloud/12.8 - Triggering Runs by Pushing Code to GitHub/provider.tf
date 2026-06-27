terraform {
  # Same cloud integration as the CLI lab, but pointing at the VCS-linked workspace.
  cloud {
    organization = "your-organization" # <-- replace with YOUR organization name

    workspaces {
      name = "terraform-vcs" # the workspace linked to the GitHub repo in lab 12.7
    }
  }

  # No random provider here — this repo only creates AWS resources.
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.0"
    }
  }
}

provider "aws" {
  region = "eu-west-1" # use whatever region is relevant for you
}
