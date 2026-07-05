# Part 4 — Inspecting Containers, Images & Mounted Config

## Introduction

What is actually running **inside** the Prometheus and Alertmanager pods? In this part you `kubectl describe` the two StatefulSets and the Operator Deployment, save the output to files, and read them: the containers, the **images and versions** they're based on, the ports, the arguments — and most importantly the **mounts** through which Prometheus gets its configuration file and rules file.

## Where You Are

- **Part 1:** chose Helm chart + Operator approach.
- **Part 2:** installed the stack and toured the workloads:

  ```bash
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
  helm repo update
  helm install prometheus prometheus-community/kube-prometheus-stack
  kubectl get all
  ```

- **Part 3:** listed where default config lives:

  ```bash
  kubectl get configmap   # per-component config + default rules
  kubectl get secret      # certs, UI credentials, generated config
  kubectl get crd         # the Operator's custom resource types
  ```

## Desired Outcome

1. Three files on disk with the describe output: `prometheus.yaml`, `alertmanager.yaml`, `operator.yaml`.
2. In the Prometheus describe you can point at:
   - the **main `prometheus` container** — its image + version, its port (**9090**), and its args;
   - the **config-reloader** helper (side) container(s) and what they do;
   - the **mounts**: the Prometheus **configuration file** and the **rules** files (plus certificates).
3. You can explain in one sentence each what the **config file** and the **rules file** are for.

> Try it yourself first using the **Desired Outcome**. Only open the step-by-step if you get stuck.

## Prerequisites

- [Part 3](../part-03-configmaps-secrets-crds/lab.md) completed.

---

## Step-by-Step Guide

### Step 1 — Get the exact StatefulSet names

```bash
kubectl get statefulset
```

You need the two names for the describe commands (`prometheus-prometheus-kube-prometheus-prometheus` and `alertmanager-prometheus-kube-prometheus-alertmanager`).

### Step 2 — Describe both StatefulSets and the Operator Deployment into files

Saving into files gives you syntax highlighting and easy searching in your editor.

```bash
kubectl describe statefulset prometheus-prometheus-kube-prometheus-prometheus > prometheus.yaml
kubectl describe statefulset alertmanager-prometheus-kube-prometheus-alertmanager > alertmanager.yaml
kubectl describe deployment prometheus-kube-prometheus-operator > operator.yaml
```

**What this does:** `kubectl describe` gives you a human-readable summary — containers, images, mounts, events. If you ever need the **whole configuration file** instead, use `kubectl get statefulset <name> -o yaml`; here we only want the containers and images.

### Step 3 — Open `prometheus.yaml` and find the containers section

Open the three files in your editor and scroll to `Containers:` in **`prometheus.yaml`**. This is the main pod where the actual Prometheus is running. You'll find:

| Container | Purpose |
|-----------|---------|
| `prometheus` | The **main container** — the actual Prometheus server |
| `config-reloader` | **Helper (side) container** — watches the config for changes and tells Prometheus to reload |
| `init-config-reloader` (Init Container) | Same image, runs **once at startup** to render the initial config |

> ℹ️ In older chart versions there were **two** sidecars — one `config-reloader` and one `rules-configmap-reloader`. Newer charts merged them: the single `config-reloader` now watches **both** the config file **and** the rules directories (you can see both in its `--watched-dir` args). The teaching point is unchanged: *helper containers reload Prometheus when configuration changes*.

### Step 4 — Read the main `prometheus` container

Interesting things to check:

- **Image** — which image and **version** it's based on, e.g. `quay.io/prometheus/prometheus:v3.13.0`.
- **Port** — Prometheus runs at **9090** (you'll port-forward to it in Part 7).
- **Args** — e.g. `--config.file=...`, `--storage.tsdb.path=...`, in case you need to check something.

### Step 5 — Read the mounts (the important part)

Look at the `Mounts:` of the `prometheus` container. This is where Prometheus gets all its configuration data:

- the Prometheus **configuration file** (under `/etc/prometheus/config_out/`);
- the **rules** files (under `/etc/prometheus/rules/...rulefiles-0/`);
- some **certificates** (`/etc/prometheus/certs`).

Everything is **mounted into the Prometheus pod** so the containers can access it.

**What you need to know about these two files:**

| File | What it defines |
|------|-----------------|
| **Configuration file** | What **endpoints Prometheus should scrape** — the addresses of the applications that expose a `/metrics` endpoint, so it knows where to get them |
| **Rules file** | Different **rules**, e.g. **alerting rules**: "when CPU usage spikes to a certain percentage, send this email to some people" |

### Step 6 — Read the `config-reloader` helper container

Check its args and mounts:

- it has access to the Prometheus **configuration file** (`--config-file=.../prometheus.yaml.gz`);
- it has the **reload URL** of Prometheus itself: `--reload-url=http://127.0.0.1:9090/-/reload` — port **9090**, because that's where Prometheus runs;
- its `--watched-dir` args point at the **rules directories** — the mount path inside the pod that **each container can access**.

When the configuration changes, this container is responsible for **reloading and letting Prometheus know** there are changes.

## Congratulations on Completing Part 4!

You've looked inside the Prometheus pod: main container (image, port 9090, args), reloader helper container(s), and the mounted **config file** + **rules file**. One question remains: *where do those mounted files come from?* That's [Part 5 — Tracing Config & Rules to Their Source](../part-05-tracing-config-sources/lab.md).
