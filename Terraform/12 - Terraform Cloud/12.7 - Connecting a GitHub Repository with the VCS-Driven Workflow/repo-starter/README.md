# terraform-course-example-terraform-cloud

Used to explore Terraform Cloud's VCS integration.

This repository is connected to a Terraform Cloud workspace (`terraform-vcs`)
using the **Version Control Workflow**: pushing Terraform code here triggers
runs in Terraform Cloud, and opening a pull request triggers a speculative plan.
