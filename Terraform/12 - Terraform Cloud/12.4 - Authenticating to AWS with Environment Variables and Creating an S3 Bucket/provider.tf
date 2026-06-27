terraform {
  # The `cloud` block links this local project to a Terraform Cloud workspace.
  # Runs triggered from the CLI execute on remote Terraform Cloud agents, not locally.
  cloud {
    organization = "your-organization" # <-- replace with YOUR organization name

    workspaces {
      name = "terraform-cli" # the workspace created in lab 12.1
    }
  }

  required_providers {
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.0"
    }
  }
}

# AWS authenticates from environment variables (AWS_ACCESS_KEY_ID /
# AWS_SECRET_ACCESS_KEY). On the remote agent those come from the workspace's
# *environment variables* in Terraform Cloud, NOT from your local shell.
provider "aws" {
  region = "eu-west-1" # use whatever region is relevant for you
}
