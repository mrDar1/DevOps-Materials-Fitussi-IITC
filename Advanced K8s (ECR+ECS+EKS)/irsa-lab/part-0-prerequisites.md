# Part 0 — Prerequisites

> **Windows users:** run all commands in this lab from **Git Bash** or **WSL** — the lab uses
> bash syntax (`export`, `sed`, `curl`, `jq`). They will not run in PowerShell or cmd as written.

## Required tools

```bash
aws --version
eksctl version
kubectl version --client
jq --version
```

Install any that are missing before continuing.

**Install `jq`** (commonly missing on Windows):

```bash
# Windows (run in PowerShell or with winget available on PATH):
winget install jqlang.jq

# macOS:  brew install jq
# Debian/Ubuntu/WSL:  sudo apt-get install -y jq
```

After installing on Windows, **open a new Git Bash shell** so `jq` is on PATH.

## Configure AWS credentials

```bash
aws configure
aws sts get-caller-identity
```

## Set shared env vars

```bash
export CLUSTER_NAME=eks-cluster-irsa
export AWS_REGION=us-east-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export BUCKET_NAME=my-irsa-test-$ACCOUNT_ID
export SA_NAME=irsa-service-account
export NAMESPACE=default
export POLICY_NAME=s3-access-policy
export ROLE_NAME=s3-access-role
```

Keep this shell open for the rest of the lab (or re-export in each new shell).
