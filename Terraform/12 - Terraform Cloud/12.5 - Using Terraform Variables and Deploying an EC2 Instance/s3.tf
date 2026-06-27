resource "aws_s3_bucket" "tf_cloud" {
  # Bucket name must be globally unique — append the random id so it never collides.
  bucket = "terraform-cloud-${random_id.this.hex}"

  tags = {
    created_by = "terraform-cloud"
  }
}
