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
  }
}

# No provider configuration or resources yet — we add a random ID in the next lab.
