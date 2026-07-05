# Part 2 — Helm Install & Overview of Created Resources

## Introduction

Time to deploy. In this part you install the whole Prometheus monitoring stack with **one Helm command**, then walk through **every Kubernetes resource** it created — StatefulSets, Deployments, ReplicaSets, a DaemonSet, Pods, and Services — and learn what each component does.

## Where You Are

From **Part 1** you know:

- The stack = Prometheus server + Alertmanager + Grafana (+ helpers).
- Deployment choice: the **`kube-prometheus-stack` Helm chart**, which installs the **Prometheus Operator**; Helm does the setup, the Operator manages the stack.
- No commands have been run yet — the minikube cluster is still **clean**.

## Desired Outcome

1. The `prometheus-community` Helm repo is added and updated.
2. A Helm release named `prometheus` of chart `kube-prometheus-stack` is installed and **all pods are Running**.
3. From `kubectl get all` you can identify and explain:
   - **2 StatefulSets** — the Prometheus server and Alertmanager (both operator-managed);
   - **3 Deployments** — the Operator itself, Grafana, and kube-state-metrics;
   - the matching **ReplicaSets**;
   - **1 DaemonSet** — node-exporter — and why it's a DaemonSet;
   - a **Service per component**.
4. You can explain what monitoring you get **out of the box** (worker-node stats + Kubernetes components).

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.

## Prerequisites

- [Part 1](../part-01-deployment-options/lab.md) completed (you know what you're installing and why).
- minikube running, `kubectl` context = `minikube`, Helm v3.

---

## Step-by-Step Guide

### Step 1 — Verify you start clean

```bash
kubectl config current-context
kubectl get all
```

You should see only the default `kubernetes` service — a clean state with no Prometheus components.

### Step 2 — Add the Helm repository and install the chart

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack
```

**What each piece means:**

| Piece | Meaning |
|-------|---------|
| `prometheus` | The **release name** we chose |
| `prometheus-community` | The **Helm repository** (the official community one) |
| `kube-prometheus-stack` | The **chart** name |

> ℹ️ The `helm install` command returns quickly, but the components take **a couple of minutes** to actually start up. Notice how fast the installation itself was — one command, and every component gets created.

### Step 3 — Wait for all pods to be Running

```bash
kubectl get pods
```

Repeat (or use `kubectl get pods -w`) until every pod shows `Running` and fully `READY`. Expect 6 pods: alertmanager, grafana, operator, kube-state-metrics, prometheus server, node-exporter.

> ✅ Success check: `2/2`, `3/3`, `1/1` in the READY column — no `0/x`, no `Pending`/`CrashLoopBackOff`.

### Step 4 — List everything that was created

```bash
kubectl get all
```

This prints all the Kubernetes components of the Prometheus stack. Work through it **from the managing, high-level components down**, as in the next steps.

### Step 5 — The two StatefulSets

```bash
kubectl get statefulset
```

| StatefulSet | What it is |
|-------------|-----------|
| `prometheus-prometheus-kube-prometheus-prometheus` | The **actual core Prometheus server**, based on the main `prometheus` image. Note the "weird chained name" — the release name + chart component names stacked together. |
| `alertmanager-prometheus-kube-prometheus-alertmanager` | The **Alertmanager** — the other stack part with persistent identity. |

> 💡 Both StatefulSets were **created and are managed by the Operator** — that's why you see the operator-ish `...kube-prometheus...` prefix in their names.

### Step 6 — The three Deployments

```bash
kubectl get deployment
```

| Deployment | Role |
|------------|------|
| `prometheus-kube-prometheus-operator` | The **Operator itself** — the main one; it's what actually created the Prometheus and Alertmanager StatefulSets (hence the shared prefix). |
| `prometheus-grafana` | **Grafana**, its own deployment. |
| `prometheus-kube-state-metrics` | **kube-state-metrics** — actually its **own Helm chart**, pulled in as a **dependency** of the chart you installed. |

**What kube-state-metrics does:** it scrapes **Kubernetes component metrics themselves** — monitors the health of Deployments, StatefulSets, Pods inside the cluster — and makes that available for Prometheus to scrape. That means you get **Kubernetes infrastructure monitoring out of the box**, with zero configuration.

### Step 7 — The ReplicaSets

```bash
kubectl get replicaset
```

One ReplicaSet per Deployment (grafana, kube-state-metrics, operator) — these are just the **underlying components** the Deployments create. Nothing to manage here yourself.

### Step 8 — The DaemonSet: node-exporter

```bash
kubectl get daemonset
```

Two things to understand:

- A **DaemonSet** runs **one pod copy on every single worker node** of the cluster — that is its defining characteristic.
- **node-exporter** connects to the node (the server itself), reads **server/worker-node metrics** — CPU usage, load, and so on — and **transforms them into Prometheus metrics** so they can be scraped.

> 💡 On minikube there is 1 node → 1 node-exporter pod. On a 10-node cluster you'd get 10, automatically.

### Step 9 — Pods and Services

```bash
kubectl get pods
kubectl get services
```

- The pods are simply what the Deployments/StatefulSets/DaemonSet spawned.
- Each component has **its own Service** (alertmanager, grafana, operator, prometheus, kube-state-metrics, node-exporter) — you'll use these in Parts 6–7 to reach the UIs.

### Step 10 — The big picture

Put it in perspective — with one command you now have:

1. **The monitoring stack itself** (server, Alertmanager, Grafana) ready to monitor things, **and**
2. **Out-of-the-box monitoring configuration** for the cluster:
   - your **worker nodes** and their statistics (via node-exporter);
   - the **Kubernetes components** — Pods, Deployments, ReplicaSets, StatefulSets… (via kube-state-metrics).

No configuration needed for any of that.

## Congratulations on Completing Part 2!

You deployed the full Prometheus monitoring stack with one Helm command and can now identify every workload resource it created — and what each contributes. Next question: *where does all the default configuration live?* Continue to [Part 3 — ConfigMaps, Secrets & CRDs](../part-03-configmaps-secrets-crds/lab.md).
