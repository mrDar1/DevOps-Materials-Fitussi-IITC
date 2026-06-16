# Step 06 — Write the deploy pipeline

**Goal:** author `.github/workflows/deploy.yml` **yourself** that builds, pushes,
and deploys **both** services to ECS on every push to `main` — authenticating
with OIDC.

This is the core exercise. No starter workflow is provided. Write it to
satisfy the requirements below.

---

## A. Requirements

- [ ] Triggers on push to `main`
- [ ] `permissions: id-token: write` and `contents: read` (required for OIDC)
- [ ] A `strategy.matrix` that treats `inventory` and `orders` as independent
      deploy targets in the same job — one service failing must not block the
      other (`fail-fast: false`)
- [ ] Assumes `vars.AWS_DEPLOY_ROLE_ARN` via
      `aws-actions/configure-aws-credentials` — **no `aws-access-key-id`
      input anywhere**
- [ ] Logs in to ECR with `aws-actions/amazon-ecr-login`
- [ ] Builds each service's image from its own folder, tags it with
      `${{ github.sha }}`, and pushes it to the matching ECR repo
- [ ] Renders each service's `task-definition.json` with the new image using
      `aws-actions/amazon-ecs-render-task-definition`, matching the right
      container name
- [ ] Deploys the rendered task definition to the matching ECS service with
      `aws-actions/amazon-ecs-deploy-task-definition`, with
      `wait-for-service-stability: true`

Pin all actions to a major version tag (e.g. `@v4`), not `@main` or a full SHA.

---

## B. Hints

- The matrix is the trick that deploys two services from one job definition.
  Give each matrix entry everything that differs between the services:
  the folder to build, the ECR repo, the ECS service name, the task-def path,
  and the **container name** (must match the `name` field inside that service's
  `task-definition.json` — `inventory` and `orders` respectively).
- `configure-aws-credentials` needs the region and `role-to-assume`; with
  `id-token: write` set, that's all OIDC requires.
- `amazon-ecr-login` outputs a `registry` value — build your image URI as
  `<registry>/<ecr_repo>:<github.sha>`.
- Pass the image from the build step into the render step, and the render
  step's `task-definition` output into the deploy step.

*Self-check questions:*
- What breaks if you forget `permissions: id-token: write`?
- Why `fail-fast: false` on the matrix — what does the default behaviour do to
  the second service when the first fails?
- Why tag images with `github.sha` instead of `latest`?

---

## C. Verify the file before pushing

- [ ] `env.AWS_REGION` and `env.ECS_CLUSTER` match the region and cluster name
      you provisioned in [Step 05](05-provision-aws-infra.md) (e.g. `eu-west-1`
      and `microsvc-cluster`)
- [ ] `container-name` in each render maps to the correct container
- [ ] There is no `aws-access-key-id` anywhere in the file
- [ ] Every action is pinned to a major version tag

---

## What you learned

- A single matrix job can deploy N independent services, each with its own
  registry, task definition, and ECS service. OIDC + the AWS actions turn
  "build → push → render → deploy" into a declarative, keyless pipeline.

## Next

→ [Step 07 — Deploy & verify end-to-end](07-deploy-and-verify.md)
