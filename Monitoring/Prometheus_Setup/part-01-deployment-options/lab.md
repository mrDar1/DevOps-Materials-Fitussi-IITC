# Part 1 — Prometheus Stack Recap & Kubernetes Deployment Options

## Introduction

Before deploying anything, you need to understand **what** you are deploying and **which deployment strategy** to pick. In this part you:

- recap the components of the Prometheus monitoring stack;
- compare the **three ways** to deploy Prometheus in a Kubernetes cluster — manual YAML, an Operator, and a Helm chart of the Operator;
- locate the official `kube-prometheus-stack` Helm chart you'll install in Part 2.

This part is mostly conceptual — the hands-on work starts in Part 2.

## Where You Are

- Starting point: a **clean minikube cluster** with no Prometheus components installed.
- Nothing has been run yet.

## Desired Outcome

1. You can name the core components of the Prometheus monitoring stack and what each one does.
2. You can explain the three deployment options and argue why the **Helm chart of the Operator** is the most efficient.
3. You can state the division of labor: **Helm = initial setup, Operator = ongoing management**.
4. You have found the `kube-prometheus-stack` chart page and its install command, ready for Part 2.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.

## Prerequisites

- The Prometheus theory lesson (how Prometheus works, its architecture).
- A browser to look up the Helm chart.

---

## Step-by-Step Guide

### Step 1 — Recap the components of the Prometheus stack

Write down (or recall) the moving parts you are about to deploy:

| Component | Role |
|-----------|------|
| **Prometheus server** | The core — stores and processes the metrics data |
| **Alertmanager** | Sends alerts based on the data Prometheus collected and processed |
| **UI / Visualization** | Prometheus has its own UI, but **Grafana** lets you build much more powerful visualization dashboards from Prometheus metrics data |

> 💡 There are *several moving parts* here — server, Alertmanager, Grafana, plus everything each needs (ConfigMaps, Secrets, Services…). That's exactly why the deployment method matters.

### Step 2 — Option 1: manual YAML files (and why not)

The first option is writing **all the configuration files yourself**: YAML for the Prometheus StatefulSet, the Alertmanager and Grafana Deployments, every ConfigMap and Secret they need — and then executing them **in the right order because of the dependencies**.

**Why this is a bad idea:**

- It's inefficient and a **lot of effort**.
- You need to know exactly what you're doing — or find a step-by-step guide and hope each step works as described (it usually doesn't).
- There are very few use cases where this option makes sense.

### Step 3 — Option 2: a Prometheus Operator

The second, more efficient way is using an **Operator**.

**Think of an Operator as a manager of all the individual Prometheus components:**

- Just like a StatefulSet or Deployment manages its pod replicas (restarts them when they die, keeps them accessible), an **Operator keeps an eye on and manages the combination** of StatefulSets, Deployments, and all the other pieces that make up the Prometheus stack — **as one unit**.
- You don't have to manually manage the separate pieces.

With this option you find a Prometheus Operator and deploy it into the cluster using the Operator's configuration files.

> ℹ️ Operators and how they work (CRDs, control loops) are a topic of their own — covered in a separate lesson. For now the "manager of the stack" mental model is enough.

### Step 4 — Option 3: a Helm chart of the Operator (the winner)

The third — and most efficient — option: use a **Helm chart to deploy the Operator**. The Prometheus community maintains an official chart for exactly this: **`kube-prometheus-stack`**.

The division of labor:

- **Helm** does the **initial setup** — one command creates every component.
- The **Operator** then **manages the running Prometheus setup** — day-2 lifecycle.

> ✅ This is the option used in the rest of this lab.

### Step 5 — Find the chart and its install command

Open the chart's page and locate the install instructions you'll run in Part 2:

- Chart repo: <https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack>
- ArtifactHub page: <https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack>

From the documentation, the install commands are:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install [RELEASE_NAME] prometheus-community/kube-prometheus-stack
```

Note the three pieces of the install command — you'll name them explicitly in Part 2:

- `[RELEASE_NAME]` — a name **you** choose for the release (we'll use `prometheus`);
- `prometheus-community` — the **Helm repository** name (the official one);
- `kube-prometheus-stack` — the **chart** name.

## Congratulations on Completing Part 1!

You now know the components of the Prometheus stack, the three deployment options, and why *Helm-installs-the-Operator* is the approach of choice: Helm for setup, Operator for management. Continue to [Part 2 — Helm Install & Resource Overview](../part-02-helm-install/lab.md) to actually deploy it.
