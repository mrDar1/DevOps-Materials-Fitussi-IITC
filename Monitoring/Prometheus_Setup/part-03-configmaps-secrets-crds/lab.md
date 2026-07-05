# Part 3 — Where the Default Config Comes From: ConfigMaps, Secrets & CRDs

## Introduction

Part 2 ended with a promise: you get monitoring configuration *out of the box*. But **where does that configuration actually come from?** In this part you list the **ConfigMaps**, **Secrets**, and **CRDs** the chart created and understand what kind of configuration lives in each.

## Where You Are

- **Part 1:** picked the `kube-prometheus-stack` Helm chart (Helm = setup, Operator = management).
- **Part 2:** installed and toured the workloads:

  ```bash
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
  helm repo update
  helm install prometheus prometheus-community/kube-prometheus-stack
  kubectl get all
  ```

  Running now: 2 StatefulSets (prometheus, alertmanager), 3 Deployments (operator, grafana, kube-state-metrics), node-exporter DaemonSet, and a Service per component.

## Desired Outcome

1. You've listed the stack's **ConfigMaps** and can say what they hold (per-component config, Grafana dashboards, the default **rules**).
2. You've listed the stack's **Secrets** and can say what they hold (certificates, UI usernames/passwords, generated configs).
3. You've listed the **CRDs** the chart installed and know they are part of the Operator pattern.
4. You can now *argue from evidence* why hand-writing all this YAML (deployment option 1) would be painful.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.

## Prerequisites

- [Part 2](../part-02-helm-install/lab.md) completed — the stack is installed and Running.

---

## Step-by-Step Guide

### Step 1 — List the ConfigMaps

```bash
kubectl get configmap
```

You'll see **a whole bunch** of them. You're not going to open each one — just observe:

- There are **configurations for all the different parts** of the stack.
- Many carry the operator-managed prefix (`prometheus-kube-prometheus-...`) — they too are managed by the Operator.
- They include the information for how the stack connects to the **default metrics** and scrapes them.
- One of them is the **default rules file** for Prometheus — spot the one ending in `...rulefiles-0`.

> 💡 Most of the `prometheus-kube-prometheus-*` ConfigMaps are actually **Grafana dashboard definitions** (one per built-in dashboard) — that's why there are so many.

### Step 2 — List the Secrets

```bash
kubectl get secret
```

Again several, for Grafana, for Prometheus, for the Operator itself — for different components. These hold:

- **certificates** (TLS assets);
- **usernames and passwords** for the different UI parts (you'll use the Grafana one in Part 6);
- generated component configs (you'll decode one in Part 5).

### Step 3 — List the CRDs

```bash
kubectl get crd
```

**CRDs — Custom Resource Definitions** — are another Kubernetes concept (covered in detail in a separate lesson). For now, know that the Prometheus stack setup **includes these custom resource definitions** — there's more to the stack than the standard resources. They're what lets the Operator manage things like `Prometheus`, `Alertmanager`, and `ServiceMonitor` as first-class Kubernetes objects.

### Step 4 — Revisit deployment option 1

Look back at everything you just listed: dozens of ConfigMaps, ~10 Secrets, ~10 CRDs — *plus* the workloads from Part 2.

> ✅ Now it should make even more sense why writing all these YAML files yourself would be a lot of effort — this whole thing has **already been done, maintained, and managed for you**. You just reuse it.

## Congratulations on Completing Part 3!

You now know where the out-of-the-box configuration lives: ConfigMaps (component config + rules + dashboards), Secrets (certs + credentials + generated config), and CRDs (the Operator's own resource types). Next you'll look **inside the pods** — containers, images, and how this config gets mounted. Continue to [Part 4 — Inspecting Containers & Mounted Config](../part-04-inspecting-containers/lab.md).
