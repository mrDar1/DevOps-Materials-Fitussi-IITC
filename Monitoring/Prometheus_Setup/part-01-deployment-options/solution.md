# Part 1 — Solution

This part is conceptual, so the "solution" is the knowledge check plus the chart lookup.

## Knowledge check answers

**1. Components of the Prometheus monitoring stack:**

- **Prometheus server** — the core; stores and processes metrics data.
- **Alertmanager** — sends alerts based on data Prometheus collected and processed.
- **Grafana** (or the built-in Prometheus UI) — visualizes the gathered/scraped data; Grafana provides powerful dashboards on top of Prometheus metrics.

**2. The three deployment options:**

| # | Option | Verdict |
|---|--------|---------|
| 1 | Write every YAML yourself (StatefulSet, Deployments, ConfigMaps, Secrets) and apply them in dependency order | Inefficient, error-prone, almost never the right choice |
| 2 | Deploy a **Prometheus Operator** using its config files — the Operator manages all stack pieces as one unit | Better — but you still set up the Operator manually |
| 3 | **Helm chart that deploys the Operator** (`kube-prometheus-stack`, maintained by the community) | ✅ Most efficient — one command |

**3. Division of labor:**

> **Helm does the initial setup; the Operator then manages the running Prometheus setup.**

## Chart lookup

Verified live (July 2026): the chart is at
<https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack>,
and the documented install command is:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install [RELEASE_NAME] prometheus-community/kube-prometheus-stack
```

- Release name used in this lab: `prometheus`
- Repo: `prometheus-community` · Chart: `kube-prometheus-stack`
- Chart version installed during the reference run: **87.10.1** (Prometheus v3.13.0, Alertmanager v0.33.1, Operator v0.92.1, Grafana 13.1.0)

> ℹ️ Your chart version will likely be newer — resource names stay the same, image tags move.
