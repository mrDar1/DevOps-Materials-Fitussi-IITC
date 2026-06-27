module "networking" {
  source = "./modules/networking"

  # --- BEFORE (Lab 1.3 + first half of this lab): two top-level primitives ---
  # vpc_cidr = "10.0.0.0/16"
  # vpc_name = "local-modules"

  # --- AFTER: grouped into a single vpc_config object ---
  # Changing the module interface like this is a BREAKING change: for a
  # published module it requires a MAJOR version bump and clients must migrate.
  vpc_config = {
    cidr_block = "10.0.0.0/16"
    name       = "local-modules"
  }
}
