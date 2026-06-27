## Introduction

Until now you've used the **CLI-Driven Workflow** — you trigger runs from your terminal. In this lab you set up the **Version Control (VCS) Workflow**: connect a **GitHub repository** to a Terraform Cloud workspace so that **pushing code** to the repo automatically triggers runs, and **opening a pull request** triggers a speculative plan.

This lab covers:

- **Creating a GitHub repo** for Terraform code (README, Terraform `.gitignore`, MIT license).
- **The Version Control Workflow** — a third workspace type where runs are driven by repository changes, not the CLI.
- **Connecting a VCS provider** — GitHub (and the fact that GitLab, Bitbucket, and Azure DevOps are also supported), including **private** repos.
- **Speculative plans on PRs** — the option that runs a plan automatically when a pull request is opened.

> 💡 This is a **setup/exploration** lab. No Terraform resources yet — the new repo only has README, `.gitignore`, and a license. You'll clone it and push resources in the next lab.
> 

## Desired Outcome

By the end you will have:

1. A new **GitHub repository** (e.g. `terraform-course-example-terraform-cloud`), **private** is fine, initialized with a **README**, a **Terraform `.gitignore`**, and an **MIT license**.
2. A new Terraform Cloud workspace created with the **Version Control Workflow**, named `terraform-vcs`, connected to that repo via the **GitHub App**.
3. The **speculative plans on pull requests** option enabled.
4. The workspace created and **waiting for configuration** (the repo has no Terraform code yet).

> Try it yourself first using the **Desired Outcome** above. Only open the step-by-step if you get stuck.
> 

## Prerequisites

- A **GitHub account** (ideally the one you signed into Terraform Cloud with in [12.1](../12.1%20-%20Creating%20a%20Workspace%20in%20Terraform%20Cloud/lab.md)).
- Your Terraform Cloud organization and its **default project**.

> The `repo-starter/` folder in this lab contains the three files GitHub generates for you (README, `.gitignore`, LICENSE) for reference.

---

## Step-by-Step Guide

### Step 1 — Create the GitHub repository

On GitHub, create a new repository:

- **Name:** something descriptive, e.g. `terraform-course-example-terraform-cloud`.
- **Description:** *"Used to explore Terraform Cloud's VCS integration."*
- **Visibility:** **Private** is fine (Terraform Cloud can connect to private repos too).
- **Add a README file:** yes.
- **Add .gitignore:** choose the **Terraform** template — GitHub populates the standard Terraform ignores for you.
- **License:** **MIT** (keep it simple/open source).

Click **Create repository**.

> ℹ️ See `repo-starter/` in this lab folder for copies of the README, `.gitignore` (Terraform), and MIT `LICENSE` that GitHub creates.
> 

---

### Step 2 — Create a Version Control workspace

In Terraform Cloud, from the home page select your **default project**, then **create a new workspace** under it. Choose the **Version Control Workflow**.

> ℹ️ The Version Control Workflow triggers runs based on **changes to the configuration in your repository** — as opposed to the CLI- or API-driven workflows.
> 

---

### Step 3 — Connect your VCS provider

You'll be taken to a screen to choose a VCS provider.

- If **GitHub** is already connected (depends on your earlier setup), pick the **GitHub App**.
- Terraform Cloud supports multiple providers — **GitHub, GitLab, Bitbucket, and Azure DevOps** — and gives you the connection instructions for whichever you choose.

Continue with the **GitHub App**.

> 💡 Even **private** GitHub repositories appear in the list — Terraform Cloud can access them, which matters because most organizations keep their repos private.
> 

---

### Step 4 — Select the repository and name the workspace

- Select the repo you just created (`terraform-course-example-terraform-cloud`).
- The workspace name defaults to the repo name — change it to **`terraform-vcs`**.
- **Description** (optional): *"This workspace is used to illustrate Terraform Cloud's VCS integration."*

Optionally expand **Advanced options**. The notable one is **pull requests → automatic speculative plans**, which is **on** by default.

> ℹ️ **Speculative plans:** when this is enabled, **opening a pull request** triggers a *plan-only* run in Terraform Cloud (no apply) so you can preview the effect of the change. You'll explore this more later in the course.
> 

Click **Create**.

---

### Step 5 — Confirm the workspace is ready

When the workspace is created for the first time, Terraform Cloud:

- Looks for any **variables** you'd need to populate, and
- Offers to **start a new plan**.

Since the repo has **no Terraform resources yet** (only `.gitignore`, `LICENSE`, and `README`), there's nothing to deploy.

> ✅ Success check: the `terraform-vcs` workspace exists, is connected to your GitHub repo, and is waiting for configuration.
> 

---

## Congratulations on Completing the Exercise!

You created a GitHub repository and connected it to a new Terraform Cloud workspace using the **Version Control Workflow**, so future pushes will trigger runs and pull requests will trigger **speculative plans**. You also saw that Terraform Cloud integrates with GitHub, GitLab, Bitbucket, and Azure DevOps, and can access **private** repositories. In the next lab you'll clone the repo, add resources, and push to see Terraform Cloud react.

> 🧹 No cloud resources were created — only a GitHub repo and a Terraform Cloud workspace, both free. Nothing to clean up yet.
> 
