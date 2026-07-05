# Part 5 — Tracing the Config & Rules Files to Their Source (Secret & ConfigMap)

## Introduction

In Part 4 you saw a config file and rules files **mounted** into the Prometheus pod — but you never defined them. Where do they come from? In this part you trace each mount back to its source: **mount → pod volume → Secret / ConfigMap**, decode them, and learn the two skills that actually matter in practice:

1. how to **adjust the Prometheus configuration** (add scrape endpoints);
2. how to **adjust the alert rules**.

You also finish the container tour: Alertmanager's own config and the Operator as orchestrator.

## Where You Are

- **Parts 1–2:** installed the stack:

  ```bash
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
  helm repo update
  helm install prometheus prometheus-community/kube-prometheus-stack
  ```

- **Part 3:** listed ConfigMaps / Secrets / CRDs (`kubectl get configmap|secret|crd`).
- **Part 4:** saved and read the describes:

  ```bash
  kubectl describe statefulset prometheus-prometheus-kube-prometheus-prometheus > prometheus.yaml
  kubectl describe statefulset alertmanager-prometheus-kube-prometheus-alertmanager > alertmanager.yaml
  kubectl describe deployment prometheus-kube-prometheus-operator > operator.yaml
  ```

  Found: main `prometheus` container (port 9090) + config-reloader helper, with the **config file** and **rules** mounted in.

## Desired Outcome

1. You've traced the **config** mount to a **Secret** and saved/decoded it (`secret.yaml`) — it contains the actual `prometheus.yaml` scrape configuration (base64-encoded).
2. You've traced the **rules** mount to a **ConfigMap** and saved it (`rules-configmap.yaml`) — it contains the default alert rules.
3. You know **exactly which object to edit** to (a) add a scrape endpoint, (b) change alert rules.
4. You've confirmed Alertmanager follows the same pattern (its own `alertmanager.yaml` + config-reloader) and can describe the Operator's role as orchestrator.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.

## Prerequisites

- [Part 4](../part-04-inspecting-containers/lab.md) completed — you have `prometheus.yaml`, `alertmanager.yaml`, `operator.yaml` describe files open.

---

## Step-by-Step Guide

### Step 1 — Understand how mounts work (mount → volume)

Where does the configuration come from? You haven't defined it — **it's part of the stack out of the box**: a default Prometheus configuration file and a default rules file, delivered through mounts. There are so many ConfigMaps that searching the list directly is hard — the reliable way is to **follow the mount**:

1. A **volume** is mounted **into the pod**.
2. Individual **containers** then mount those pod volumes at a **container path**, so they can access them.

So: find the container mount → find the matching **pod volume** → the volume names its **source** (Secret or ConfigMap).

### Step 2 — Trace the configuration file to a Secret

In `prometheus.yaml` (the describe file), find the `config-reloader`'s mount for the config, then scroll down to the pod `Volumes:` section and find the volume it references — the one named `config`:

```text
Volumes:
 config:
  Type:        Secret (a volume populated by a Secret)
  SecretName:  prometheus-prometheus-kube-prometheus-prometheus
```

> 💡 Surprise: it's **a Secret, not a ConfigMap**. Note the secret name.

### Step 3 — Save and inspect the Secret

```bash
kubectl get secret prometheus-prometheus-kube-prometheus-prometheus -o yaml > secret.yaml
```

Open **`secret.yaml`**: under `data:` you'll find the **`prometheus.yaml`** file (the name that's mounted into the pod) — **base64-encoded, because it's a Secret**. You can decode it and see all the information:

```bash
kubectl get secret prometheus-prometheus-kube-prometheus-prometheus \
  -o jsonpath='{.data.prometheus\.yaml\.gz}' | base64 -d | gunzip | head -40
```

> ℹ️ In current chart versions the key is `prometheus.yaml.gz` — base64 **and** gzipped, hence the extra `gunzip`. Older charts stored plain `prometheus.yaml` (only `base64 -d` needed).

Inside you'll see `scrape_configs:` with one `job_name:` per monitored endpoint — this is **the** file that defines what Prometheus scrapes.

### Step 4 — Trace the rules file to a ConfigMap

Back in the describe file: the reloader's `--watched-dir` mounts the rules volume with the long name `prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0`. Go down to `Volumes:`:

```text
prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0:
 Type:      ConfigMap (a volume populated by a ConfigMap)
 Name:      prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0
```

This one **is** a ConfigMap. Save it:

```bash
kubectl get configmap prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0 -o yaml > rules-configmap.yaml
```

Open **`rules-configmap.yaml`**: each `data:` key is a rule file name, and the value is the file contents — the **alert rules** (`alert:`, `expr:`, `for:`, `severity:`) and some other stuff.

### Step 5 — Know what you'd edit (the practical takeaway)

| You want to… | Edit… |
|--------------|-------|
| **Add a new endpoint to scrape** | The **Secret** — the `prometheus.yaml` config file inside it |
| **Add / adjust alert rules** | The **rules** (ConfigMap / `PrometheusRule` resources) |

> 💡 In a later demo you'll add an **exporter as a side container** for a database pod and configure Prometheus to scrape that endpoint — that's when you'll adjust the configuration file for real.

### Step 6 — Check Alertmanager the same way

In `alertmanager.yaml` (describe file): the main `alertmanager` container has **its own default configuration file, `alertmanager.yaml`**, plus **the same config-reloader helper container**. Same pattern, same tracing technique.

### Step 7 — The Operator: the orchestrator

In `operator.yaml`: a single `prometheus-operator` container. (You can also check the image's documentation for what it does and how it works.) This is the **orchestrator of the whole monitoring stack** — it manages all the moving parts, loads all this configuration, and orchestrates how everything works together.

> ✅ You **don't** need to understand how all of these internals work. The two things that matter: **(1)** how to add/adjust **alert rules** and alert configuration, **(2)** how to adjust the **Prometheus configuration** to add scrape endpoints. The rest is overview.

## Congratulations on Completing Part 5!

You can now trace any mounted config in the stack to its Secret or ConfigMap, decode it, and you know exactly where scrape endpoints and alert rules are changed. Time to actually **see** the collected data: [Part 6 — Accessing the Grafana UI](../part-06-grafana-ui/lab.md).
