# Part 7 — The Prometheus UI (Alerts, Config, Targets, Rules), Summary & Cleanup

## Introduction

Grafana isn't the only window into the stack — **Prometheus has its own UI**. In this final part you port-forward to it, inspect the **Alerts**, the running **Configuration**, the **Targets** (with their health status), and the **Rules** — closing the loop on everything you traced in Parts 3–5. You finish with the big-picture summary and a full **cleanup**.

## Where You Are

- **Parts 1–2:** installed the stack:

  ```bash
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
  helm repo update
  helm install prometheus prometheus-community/kube-prometheus-stack
  ```

- **Part 3:** found config in ConfigMaps / Secrets / CRDs.
- **Parts 4–5:** inspected containers; learned Prometheus runs on **port 9090**; traced scrape config → **Secret**, alert rules → **ConfigMap**.
- **Part 6:** port-forwarded Grafana (port 3000, `admin` + password from the `prometheus-grafana` Secret) and explored dashboards:

  ```bash
  kubectl port-forward deployment/prometheus-grafana 3000
  ```

## Desired Outcome

1. `kubectl port-forward` opens the **Prometheus UI** at `localhost:9090`.
2. In the UI you've viewed: **Alerts** (from the default rules file), **Status → Configuration**, **Status → Targets** (health status, including the ones that are *down* on minikube), and **Rules**.
3. You can summarize the whole lab in three sentences (deployment method, what was created, where config lives).
4. 🧹 The stack is **uninstalled** and the cluster is clean.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.

## Prerequisites

- [Part 6](../part-06-grafana-ui/lab.md) completed.

---

## Step-by-Step Guide

### Step 1 — Port-forward to Prometheus

As you saw in Part 4, Prometheus runs on port **9090**. Forward it (service or pod both work):

```bash
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090
```

Open **<http://localhost:9090>** → the Prometheus UI. Here you can display the alerts, display the configuration and which metric endpoints are being scraped, and use the **PromQL** language to query different stuff.

### Step 2 — Alerts

Open the **Alerts** tab: the **default alerts**, configured from the default **alert rules file** — the exact rules you saw inside the rulefiles ConfigMap in Part 5 (`AlertmanagerFailedReload`, `Watchdog`, node and kubelet alerts, …).

### Step 3 — Status → Configuration

**Status → Configuration** shows the live, rendered Prometheus configuration — the decoded content of the Secret from Part 5.

> ℹ️ It's **pretty long and pretty complex** — if you're just starting off it takes time to learn. You don't need to master it now.

### Step 4 — Status → Targets

**Status → Targets** lists **each target being scraped** — the pods being monitored — **and their health status**.

> 💡 Expect to see **some targets down** on minikube (typically `kube-controller-manager`, `kube-scheduler`, `etcd`). That's normal here: minikube binds those control-plane components to localhost, so Prometheus can't reach their metrics ports. The transcript hits the same thing ("you see for example some things down").

### Step 5 — Rules

The **Rules** page (Status → Rules, or the Alerts tab's rule links) shows your **rules configuration** — the same 35 rule groups, now live and evaluated.

> ✅ The Prometheus UI can be genuinely useful — you can get a lot of information there, especially Targets when debugging scraping.

### Step 6 — Summarize the whole lab

To summarize:

1. You deployed the **whole Prometheus monitoring stack with Helm** — one straightforward command that in the background created the whole array of components that make up the stack.
2. You got a brief overview of **what those components are and do** (server, Alertmanager, Grafana, node-exporter, kube-state-metrics, Operator) and where every piece of **configuration** lives (Secret for scrape config, ConfigMap for rules).
3. **Coming next:** a demo configuring an **additional metrics endpoint** — e.g. a database application running in the cluster — i.e. monitoring your own services and applications by exposing a metrics endpoint.

### Step 7 — 🧹 Cleanup

Stop the port-forwards (`Ctrl+C`), then remove the stack:

```bash
helm uninstall prometheus
```

The chart intentionally leaves the **CRDs** behind (so a reinstall keeps existing custom resources). To remove them too:

```bash
kubectl delete crd alertmanagerconfigs.monitoring.coreos.com alertmanagers.monitoring.coreos.com \
  podmonitors.monitoring.coreos.com probes.monitoring.coreos.com prometheusagents.monitoring.coreos.com \
  prometheuses.monitoring.coreos.com prometheusrules.monitoring.coreos.com scrapeconfigs.monitoring.coreos.com \
  servicemonitors.monitoring.coreos.com thanosrulers.monitoring.coreos.com
```

Verify the cluster is clean:

```bash
kubectl get all
kubectl get crd | grep monitoring
```

> ✅ `kubectl get all` shows only `service/kubernetes`; the grep returns nothing.

## Congratulations on Completing the Exercise!

You deployed a production-grade monitoring stack with a single Helm command, dissected every resource it created, traced all its configuration to Secrets and ConfigMaps, and used both the Grafana and Prometheus UIs — and you know the two skills that matter going forward: adding **scrape endpoints** and adjusting **alert rules**. See you in the exporter demo!
