# Lab 1.11 — Publishing to the Registry and Using the Remote Module

This lab has two solution areas:

- **`module-repo/`** — the contents you push to a **new public GitHub repo**
  named `terraform-aws-networking-tf-course` to publish on the Terraform
  Registry. These are the **v0.1.1** files (variable descriptions added). The
  module lives at the **repo root** (not under `modules/`) for publishing.
  Tag releases with SemVer: `v0.1.0` (first), then `v0.1.1` (descriptions).

- **`use-module/`** — a root configuration that **consumes the remote
  module** by `source = "<your-namespace>/networking-tf-course/aws"` +
  `version`. Replace `<your-namespace>` with your own registry namespace.
  Because the source is a registry address, this only resolves after you have
  actually published the module to the registry under your account.

See `lab.md` for the full step-by-step (Parts A–C).

> The publishing steps act on your own GitHub + Terraform Registry account.
> Nothing is auto-published for you.
