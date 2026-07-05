# Part 6 — Accessing the Grafana UI via Port-Forward & Exploring Dashboards

## Introduction

The stack has been collecting data since Part 2 — time to **see** it. In this part you discover why the services aren't reachable from outside, use **`kubectl port-forward`** to open Grafana locally, find the login credentials, and explore the **built-in dashboards** (nodes, pods, control plane, Prometheus itself).

## Where You Are

- **Parts 1–2:** installed the stack:

  ```bash
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
  helm repo update
  helm install prometheus prometheus-community/kube-prometheus-stack
  ```

- **Part 3:** located config in ConfigMaps / Secrets / CRDs.
- **Parts 4–5:** inspected containers and traced the config Secret + rules ConfigMap:

  ```bash
  kubectl describe statefulset prometheus-prometheus-kube-prometheus-prometheus > prometheus.yaml
  kubectl get secret prometheus-prometheus-kube-prometheus-prometheus -o yaml > secret.yaml
  kubectl get configmap prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0 -o yaml > rules-configmap.yaml
  ```

- Key facts so far: Prometheus listens on **9090**; node-exporter + kube-state-metrics feed it node and cluster metrics out of the box.

## Desired Outcome

1. You can explain why `kubectl get service` shows only **ClusterIP** services and what you'd use in production instead (**Ingress**).
2. You found Grafana's port (**3000**) and default user (**admin**) from the **container logs**, and retrieved the admin **password**.
3. `kubectl port-forward deployment/prometheus-grafana 3000` gives you the Grafana login page at `localhost:3000`, and you can log in.
4. You've explored the built-in dashboards: node metrics (node-exporter), pod/namespace metrics (kube-state-metrics), control-plane components, and Prometheus self-monitoring.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.

## Prerequisites

- [Part 5](../part-05-tracing-config-sources/lab.md) completed; stack Running.
- A free local port 3000 (or use a different local port — see the ⚠️ in Step 4).

---

## Step-by-Step Guide

### Step 1 — Look at the services: everything is internal

```bash
kubectl get service
```

All the stack's services — including `prometheus-grafana` — are of type **ClusterIP**, the **internal** service type. They are **not open to external requests**.

> ℹ️ In **production** you would configure an **Ingress** and point Ingress rules at the Prometheus / Grafana services. In this setup you'll use **port-forward** instead.

### Step 2 — Find the Grafana pod and its port from the logs

You'll port-forward to the Grafana **deployment**. First confirm what port Grafana listens on — read the logs:

```bash
kubectl get pods
kubectl logs deployment/prometheus-grafana -c grafana
```

**Why `-c grafana`?** The Grafana pod has **multiple containers** inside — you must choose one; you want the `grafana` container.

In the logs, find:

- `HTTP Server Listen ... :3000` → Grafana listens at **port 3000** — that's the port to forward;
- `GF_SECURITY_ADMIN_USER=admin` → the **default user is `admin`**.

### Step 3 — Get the admin password

The transcript-era chart shipped a fixed default password documented in the chart (`prom-operator`). **Current chart versions generate a random password** and store it in the `prometheus-grafana` Secret (Part 3 spotted it!). Retrieve it:

```bash
kubectl get secret prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d ; echo
```

> 💡 This exact command was printed in the `helm install` NOTES back in Part 2. You can change the password of course (chart value `grafana.adminPassword`).

### Step 4 — Port-forward to Grafana

```bash
kubectl port-forward deployment/prometheus-grafana 3000
```

This opens port 3000 on localhost. Open **<http://localhost:3000>** → the Grafana **login page**. Log in with `admin` + the password from Step 3.

> ⚠️ If something else already uses local port 3000 (a Node/Express dev server is a classic), forward to a different local port instead: `kubectl port-forward deployment/prometheus-grafana 3001:3000` → browse `localhost:3001`.

> ✅ Success check: the page titled **Grafana** loads and the login succeeds.

### Step 5 — Explore what Grafana gives you

In Grafana you get a good overview of the whole stack:

- see the different **alert rules**;
- use the **PromQL** query language to query the Prometheus database for different kinds of data;
- and — most useful now — see the data Prometheus **is already collecting and scraping**.

### Step 6 — The built-in dashboards

Open **Dashboards** (transcript: "Manage dashboards") — a list of everything the stack already monitors:

| Dashboard area | Fed by | What you see |
|----------------|--------|--------------|
| **Node Exporter / Nodes** | node-exporter DaemonSet | Metrics of the node itself — CPU usage, memory usage, etc. One node here: **minikube**. The node IP in the dashboard matches `kubectl get nodes -o wide` |
| **Kubernetes / Compute Resources (Pod, Namespace, Workload)** | kube-state-metrics | Per-pod / per-namespace CPU, memory, bandwidth; pick namespace + pod to inspect |
| **Scheduler / API server / CoreDNS / etcd / Proxy** | control-plane scrape jobs | Monitoring of the **master processes** |
| **Prometheus / Overview** | Prometheus self-scrape | **Prometheus monitors itself by default** |

Verify the node IP claim:

```bash
kubectl get nodes -o wide
```

> 💡 Later, when you add configuration to scrape more endpoints, additional components will show up here as well. And you can always **create your own dashboards** for whatever you want to see.

## Congratulations on Completing Part 6!

You reached Grafana through a port-forward, logged in with credentials you dug out of logs and a Secret, and toured the out-of-the-box dashboards for nodes, pods, and the control plane. One UI left — Prometheus's own: [Part 7 — The Prometheus UI & Wrap-Up](../part-07-prometheus-ui/lab.md).
