# Step 04 — Prepare the GitHub repo

**Goal:** get your code into a standalone GitHub repo and wire up the one piece
of configuration the OIDC pipeline needs — the deploy role ARN, stored as a
repo **variable** (not a secret).

---

## A. Create the repo and publish it from VS Code

Your lab folder should already hold both `*-service/` folders (with the
`Dockerfile`s you wrote), your `docker-compose.yml`, and `.gitignore` at its
root. You'll turn that folder into a Git repo and push it to GitHub **entirely
from the VS Code UI** — no `git` or `gh` commands needed.

1. **Open the lab folder in VS Code** (`File → Open Folder…`) so it's the root
   of your workspace.

2. **Initialize the repo.** Open the **Source Control** view (the branch icon in
   the activity bar, or `Ctrl+Shift+G`). Click **Initialize Repository**. VS Code
   creates the `.git` folder and lists every file as a pending change.

3. **Sanity-check what's staged.** In the **Changes** list, confirm you do **not**
   see `.venv/`, `__pycache__/`, or `.pytest_cache/`. If you do, your
   `.gitignore` isn't being picked up — fix it before committing. Only your
   source, `Dockerfile`s, `docker-compose.yml`, and `.gitignore` should appear.

4. **Make the first commit.** Type a message like
   `feat: initial microservices-ecs-deploy` in the box at the top, then click the
   **✓ Commit** button. When VS Code asks to stage all changes, accept.

5. **Publish to GitHub.** Click **Publish Branch** (it replaces the commit
   button after your first commit). VS Code prompts you to sign in to GitHub the
   first time, then asks for a repo name and **public vs. private** — choose
   **private** and confirm. VS Code creates the GitHub repo and pushes `main` for
   you in one step.

> **Why publish from VS Code?** The built-in GitHub integration creates the
> remote repo *and* pushes your branch in a single action, so you skip
> `gh repo create`, setting the remote, and the first `git push` by hand. After
> this, the **Sync Changes** button push/pulls for you.

> Confirm in the Source Control view that the working tree is clean (no pending
> changes) after publishing — that means everything committed and pushed.

---

## B. Set up keyless AWS auth (OIDC) — you build this yourself

Nothing is handed to you here. You create the AWS-side trust **from scratch in
the AWS Console** so GitHub Actions can deploy without any stored access keys.
The pipeline authenticates using **GitHub OIDC**: GitHub issues a short-lived
identity token, AWS verifies it against a trust policy you define, and hands back
temporary credentials. Nothing long-lived is ever stored in GitHub.

You'll do this in three parts, all in the AWS Console.

### B.1 — Register GitHub as an OIDC identity provider

In **IAM → Identity providers → Add provider**:

- [ ] Provider type: **OpenID Connect**
- [ ] Provider URL: `https://token.actions.githubusercontent.com`
- [ ] Click **Get thumbprint**
- [ ] Audience: `sts.amazonaws.com`
- [ ] **Add provider**

> This is a one-time, account-wide registration that tells AWS to *trust tokens
> signed by GitHub*. You still scope *which* repo can use it in the role below.

### B.2 — Create the deploy role with a scoped trust policy

In **IAM → Roles → Create role**:

- [ ] Trusted entity type: **Web identity**
- [ ] Identity provider: the `token.actions.githubusercontent.com` you just added
- [ ] Audience: `sts.amazonaws.com`
- [ ] After creating, **edit the trust policy** so the `sub` condition matches
      **your** repo and the `main` branch exactly:
      `repo:<your-username>/microservices-ecs-deploy:ref:refs/heads/main`

The trust policy condition block should look like this (substitute your repo):

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  },
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:<your-username>/microservices-ecs-deploy:ref:refs/heads/main"
  }
}
```

- [ ] Attach permissions the deploy needs. For this lab, the simplest path is the
      AWS-managed policies **`AmazonEC2ContainerRegistryPowerUser`** (push to ECR)
      and **`AmazonECS_FullAccess`** (register task defs + update services), plus
      `iam:PassRole` for the ECS task/execution roles. In a real account you'd
      tighten these; here, getting the deploy working comes first.
- [ ] Name the role something like `github-actions-deploy` and create it.
- [ ] Copy its **ARN** — you need it in B.3.

> **Why scope the `sub`?** Without the `StringLike` on `sub`, *any* GitHub repo
> in the world could assume your role. The condition pins it to your repo **and**
> the `main` branch, so only your deploy workflow can authenticate.

### B.3 — Store the role ARN as a repo variable

The role ARN is **not a secret** — it's just an identifier — so store it as a
repo **variable**. In your GitHub repo: **Settings → Secrets and variables →
Actions → Variables tab → New repository variable**:

- [ ] Name: `AWS_DEPLOY_ROLE_ARN`
- [ ] Value: the role ARN you copied in B.2

> If you store it as a *secret* instead, `vars.AWS_DEPLOY_ROLE_ARN` in the
> workflow resolves empty and the credentials step fails. Use a **variable**.

*Self-check questions:*
- Why is a role ARN safe to store as a *variable* and not a secret?
- What does OIDC give you that a stored `AWS_ACCESS_KEY_ID` / `SECRET` pair
  does not?
- What exactly does the `sub` condition stop someone else from doing?

---

## What you learned

- OIDC replaces long-lived AWS access keys with short-lived, per-run tokens —
  nothing secret-shaped ever lives in GitHub. You registered GitHub as an
  identity provider, created a deploy role scoped by trust policy to your repo
  and branch, and stored its ARN as a plain repo variable.

## Checklist

- [ ] A standalone GitHub repo exists with the lab contents at its root
- [ ] No `.venv/`, `__pycache__/`, or `.pytest_cache/` committed
- [ ] GitHub is registered as an **OIDC identity provider** in IAM
- [ ] A deploy role exists whose trust policy `sub` pins your repo **and** `main`
- [ ] **No AWS access keys** stored as GitHub secrets — OIDC only
- [ ] `AWS_DEPLOY_ROLE_ARN` is set as a repo **variable**

## Next

→ [Step 05 — Provision the AWS infrastructure](05-provision-aws-infra.md)
