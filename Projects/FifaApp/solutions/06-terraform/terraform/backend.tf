terraform {
  backend "s3" {
    # Replace with the bucket name from step 0-bootstrap output
    bucket = "fifaapp-tfstate-<YOUR_SUFFIX>"
    key    = "eks/terraform.tfstate"
    region = "us-east-1"
  }
}
