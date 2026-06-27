# Added on the `s3` branch and merged via pull request (the speculative plan demo).
resource "aws_s3_bucket" "tf_cloud" {
  # S3 names are globally unique — append any random-enough string of your own.
  bucket = "terraform-cloud-vcs-<random>"
}
