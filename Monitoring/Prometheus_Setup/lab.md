# Prometheus on Kubernetes — Deploying the Monitoring Stack with Helm

## Introduction

In this multi-part lab you deploy the **complete Prometheus monitoring stack** (Prometheus server, Alertmanager, Grafana, node-exporter, kube-state-metrics, and the Prometheus **Operator**) into a Kubernetes cluster with a **single Helm command** — and then take it apart piece by piece to understand what was actually created, where every bit of configuration lives, and how to reach the UIs.

The lab is divided into **7 parts**, one per lecture segment. Each part:

- opens with a **"Where You Are"** recap of everything done in the previous parts (including the exact commands), so you can resume from any part;
- has its own `lab.md` (instructions) and `solution.md` (every command with **real captured output** from a live minikube run).

> 💡 The big idea of this lab: **Helm does the initial setup, the Operator manages the running stack.** You get full Kubernetes cluster + node monitoring out of the box, without writing a single YAML file yourself.

## Learning Path

| Part | Folder | What you learn |
|------|--------|----------------|
| 1 | [part-01-deployment-options](part-01-deployment-options/lab.md) | Stack components recap; 3 ways to deploy Prometheus on K8s and why Helm + Operator wins |
| 2 | [part-02-helm-install](part-02-helm-install/lab.md) | `helm install` the stack; tour every resource it creates (StatefulSets, Deployments, DaemonSet, Services) |
| 3 | [part-03-configmaps-secrets-crds](part-03-configmaps-secrets-crds/lab.md) | Where default config comes from: ConfigMaps, Secrets, and CRDs |
| 4 | [part-04-inspecting-containers](part-04-inspecting-containers/lab.md) | `kubectl describe` the StatefulSets/Deployment; containers, images, args, and mounted config |
| 5 | [part-05-tracing-config-sources](part-05-tracing-config-sources/lab.md) | Trace mounts → volumes → the Secret (scrape config) and ConfigMap (alert rules) behind them |
| 6 | [part-06-grafana-ui](part-06-grafana-ui/lab.md) | Port-forward into Grafana; explore the built-in dashboards |
| 7 | [part-07-prometheus-ui](part-07-prometheus-ui/lab.md) | Port-forward into the Prometheus UI (Alerts, Config, Targets, Rules); summary + cleanup |

## Prerequisites (for the whole lab)

- A running local Kubernetes cluster — **minikube** is used throughout (`minikube start`).
- `kubectl` configured with the `minikube` context (`kubectl config current-context`).
- `helm` v3 installed.
- No Prometheus components installed yet (clean state).

> ⚠️ If you have multiple kube contexts (EKS, docker-desktop, …), double-check the current context **before** installing anything: `kubectl config current-context` must print `minikube`.

## How to Work Through It

1. Go part by part, in order. Read the **Desired Outcome** of each part and try to get there yourself.
2. Only open the part's `solution.md` when stuck — it shows the exact commands **and the real output** you should expect.
3. Part 7 ends with a 🧹 **cleanup** step (`helm uninstall` + CRD removal). Don't skip it.
