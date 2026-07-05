# Part 4 — Solution

The three saved describe files from the reference run are in this folder: [prometheus.yaml](prometheus.yaml), [alertmanager.yaml](alertmanager.yaml), [operator.yaml](operator.yaml). Key excerpts below.

## Step 1 — StatefulSet names

```bash
kubectl get statefulset
```

```text
NAME                                                   READY   AGE
alertmanager-prometheus-kube-prometheus-alertmanager   1/1     108s
prometheus-prometheus-kube-prometheus-prometheus       1/1     108s
```

## Step 2 — Save the describes

```bash
kubectl describe statefulset prometheus-prometheus-kube-prometheus-prometheus > prometheus.yaml
kubectl describe statefulset alertmanager-prometheus-kube-prometheus-alertmanager > alertmanager.yaml
kubectl describe deployment prometheus-kube-prometheus-operator > operator.yaml
```

No output = success; the three files appear in your working directory.

## Steps 3–4 — Prometheus containers & image

From [prometheus.yaml](prometheus.yaml):

```text
Containers:
 prometheus:
  Image:      quay.io/prometheus/prometheus:v3.13.0-distroless
  Port:       9090/TCP (http-web)
  Args:
    --config.file=/etc/prometheus/config_out/prometheus.env.yaml
    --web.enable-lifecycle
    --storage.tsdb.path=/prometheus
    ...
```

- Main container `prometheus`, image **`quay.io/prometheus/prometheus:v3.13.0`**, running at port **9090**.
- Plus the helper: `config-reloader` (and an `init-config-reloader` Init Container, same image `quay.io/prometheus-operator/prometheus-config-reloader:v0.92.1`).

> ℹ️ Transcript-era charts showed a third container (`rules-configmap-reloader`). Current charts fold rules-watching into the single `config-reloader` — see its `--watched-dir` args below.

## Step 5 — Mounts of the `prometheus` container

```text
Mounts:
  /etc/prometheus/certs from tls-assets (ro)
  /etc/prometheus/config_out from config-out (ro)
  /etc/prometheus/rules/prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0 from prometheus-...-rulefiles-0 (ro)
  /prometheus from prometheus-...-db (rw)
```

Exactly the three teaching items: **config file** (config_out), **rules file(s)** (rulefiles-0), **certificates** (certs) — all mounted into the pod.

- Config file → defines the **scrape endpoints** (`/metrics` addresses).
- Rules file → defines **alerting rules** ("CPU spikes over X% → email these people").

## Step 6 — The `config-reloader` helper container

```text
config-reloader:
  Image:      quay.io/prometheus-operator/prometheus-config-reloader:v0.92.1
  Args:
    --listen-address=:8080
    --reload-url=http://127.0.0.1:9090/-/reload
    --config-file=/etc/prometheus/config/prometheus.yaml.gz
    --config-envsubst-file=/etc/prometheus/config_out/prometheus.env.yaml
    --watched-dir=/etc/prometheus/rules/prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0
    ...
  Mounts:
    /etc/prometheus/config from config (rw)
    /etc/prometheus/config_out from config-out (rw)
    /etc/prometheus/rules/...rulefiles-0 from prometheus-...-rulefiles-0 (rw)
```

Reading it:

- `--config-file=...prometheus.yaml.gz` → it **has access to the Prometheus configuration file**.
- `--reload-url=http://127.0.0.1:9090/-/reload` → **the endpoint of Prometheus itself** (port 9090) that it pokes when config changes.
- `--watched-dir=.../rulefiles-0` → it also watches the **rules** mount path inside the pod (each container can access that path).

## Alertmanager & Operator (quick look)

From [alertmanager.yaml](alertmanager.yaml):

```text
Containers:
 alertmanager:
  Image:  quay.io/prometheus/alertmanager:v0.33.1
  Ports:  9093/TCP (http-web), ...
  Args:
    --config.file=/etc/alertmanager/config_out/alertmanager.env.yaml
 config-reloader:
  Image:  quay.io/prometheus-operator/prometheus-config-reloader:v0.92.1
```

Same pattern: main container + its **`alertmanager.yaml`** default config + the same **config-reloader** helper. (Explored further in Part 5.)

From [operator.yaml](operator.yaml):

```text
Containers:
 kube-prometheus-stack:
  Image: quay.io/prometheus-operator/prometheus-operator:v0.92.1
```

A single container — the **orchestrator** of the whole stack.
