# Stage 9 — Monitoring with Prometheus and Grafana

## Goal
Install the `kube-prometheus-stack` Helm chart (Prometheus + Grafana + Alertmanager +
node-exporter + kube-state-metrics) into the cluster, instrument the backend with a
`/metrics` endpoint, and build a Grafana dashboard showing request rate, latency, error
rate, and pod memory for `fifaapp-backend`.

---

## What you're building

```
FifaApp-backend (/metrics) ──scrape──▶ Prometheus ──▶ Grafana dashboard
kubelet / cAdvisor / kube-state-metrics ──scrape──▶ Prometheus (cluster metrics, free)
```

`kube-prometheus-stack` gives you cluster and node metrics out of the box — CPU, memory,
pod counts — with zero app changes. The backend gets its **own** `/metrics` endpoint so
you can see application-level numbers (requests/sec, latency, 5xx rate) next to the
cluster numbers. The frontend is covered only by the free cluster-level metrics in this
stage — no nginx exporter sidecar (that's a natural follow-up, not required here).

---

## What changes

| | Stage 8 | Stage 9 |
|--|--|--|
| Visibility | `kubectl get pods`, ArgoCD UI | Grafana dashboards, PromQL |
| Backend metrics | None | `/metrics` (Prometheus format) |
| Node count | 2x t3.medium | 3x t3.medium (headroom for the stack) |
| New namespace | — | `monitoring` |
| Alerting | — | Alertmanager (installed, not configured) |

> **Why 3 nodes?** `kube-prometheus-stack` wants roughly 1–2 GiB of RAM for Prometheus
> alone at default settings, on top of ArgoCD, the AWS LB Controller, and the app. Two
> t3.medium nodes (8 GiB total) is tight; a third gives real headroom. `variables.tf`
> `desired_nodes` default is now `3` — bump it before applying if your workspace already
> pinned a value.

---

## Step 1 — Add a `/metrics` endpoint to the backend

```bash
cd FifaApp-backend
```

Add to `requirements.txt`:

```
prometheus-fastapi-instrumentator==6.1.0
```

In `main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from routes import players

app = FastAPI(title="FifaApp API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router, prefix="/api")

Instrumentator().instrument(app).expose(app)
```

`Instrumentator()` adds middleware that times every request and exposes the results at
`GET /metrics` in Prometheus's text format — request counts by path/status, latency
histograms, in-progress requests.

Run it locally and check:

```bash
uvicorn main:app --reload
curl localhost:8000/metrics | head -20
```

```
# HELP http_requests_total Total number of requests by method, status and handler.
# TYPE http_requests_total counter
http_requests_total{handler="/health",method="GET",status="2xx"} 1.0
...
```

Commit and push — the Stage 8 CI/CD pipeline builds and deploys this automatically.

```bash
git add requirements.txt main.py
git commit -m "Expose /metrics via prometheus-fastapi-instrumentator"
git push
```

---

## Step 2 — Bump the node group

In `FifaApp-infra/terraform/variables.tf`:

```hcl
variable "desired_nodes" {
  description = "Desired number of EKS worker nodes"
  type        = number
  default     = 3
}
```

Commit and push — TFC applies it via the Stage 6 VCS flow.

---

## Step 3 — Install kube-prometheus-stack

In `FifaApp-infra/terraform/`, create `monitoring.tf`:

```hcl
resource "helm_release" "kube_prometheus_stack" {
  name             = "monitoring"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  namespace        = "monitoring"
  create_namespace = true
  version          = "65.5.1"

  depends_on = [module.eks]

  # Fit comfortably on 3x t3.medium alongside ArgoCD + the app — no HA, short retention.
  set {
    name  = "prometheus.prometheusSpec.retention"
    value = "6h"
  }

  set {
    name  = "prometheus.prometheusSpec.resources.requests.memory"
    value = "512Mi"
  }

  set {
    name  = "prometheus.prometheusSpec.resources.limits.memory"
    value = "1Gi"
  }

  set {
    name  = "grafana.adminPassword"
    value = var.grafana_admin_password
  }

  # ArgoCD already runs the server insecure over port-forward (Stage 7) — same pattern for Grafana
  set {
    name  = "grafana.service.type"
    value = "ClusterIP"
  }
}
```

And `variables-monitoring.tf`:

```hcl
variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  sensitive   = true
}
```

Set `grafana_admin_password` in the TFC workspace (Variables → Terraform variable,
mark **sensitive**), same as you'd set any other secret input.

> Same `helm_release` pattern as `argocd.tf` (Stage 7) and `alb-controller.tf` (Stage 6)
> — one more Helm chart on a cluster that already knows how to install them.

Commit, push, Confirm & Apply in TFC:

```bash
cd FifaApp-infra
git add terraform/monitoring.tf terraform/variables-monitoring.tf
git commit -m "Install kube-prometheus-stack"
git push
```

---

## Step 4 — Tell Prometheus to scrape the backend

`kube-prometheus-stack` discovers scrape targets via `ServiceMonitor` custom resources,
matched by the `release: monitoring` label. The backend's existing Service needs a named
port first — add `name: http` to `k8s/backend/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: fifaapp-backend-svc
  namespace: fifaapp
spec:
  selector:
    app: fifaapp-backend
  ports:
    - name: http
      port: 8000
      targetPort: 8000
  type: ClusterIP
```

Then create `k8s/backend/servicemonitor.yaml`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: fifaapp-backend
  namespace: fifaapp
  labels:
    release: monitoring
spec:
  selector:
    matchLabels:
      app: fifaapp-backend
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
  namespaceSelector:
    matchNames:
      - fifaapp
```

Commit and push — ArgoCD applies both files.

```bash
git add k8s/backend/service.yaml k8s/backend/servicemonitor.yaml
git commit -m "Add ServiceMonitor for backend /metrics"
git push
```

> **`release: monitoring` label is the whole trick.** `kube-prometheus-stack`'s Prometheus
> is configured (by the chart's defaults) to only pick up `ServiceMonitor`s carrying this
> label — it's how the chart avoids scraping every ServiceMonitor in the cluster.

---

## Step 5 — Open Grafana

```bash
kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80
```

Open [http://localhost:3000](http://localhost:3000). Username `admin`, password is whatever
you set as `grafana_admin_password` in TFC.

Go to **Explore**, pick the `Prometheus` data source (pre-wired by the chart), and query:

```
http_requests_total{job="fifaapp-backend"}
```

You should see a result — this confirms the scrape is working before you build a dashboard.

---

## Step 6 — Add the backend dashboard

Grafana auto-loads any ConfigMap labeled `grafana_dashboard: "1"` in the `monitoring`
namespace (the chart's sidecar watches for it). Create
`k8s/backend-dashboard-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fifaapp-backend-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  fifaapp-backend.json: |
    {
      "title": "FifaApp Backend",
      "uid": "fifaapp-backend",
      "panels": [
        {
          "title": "Request rate",
          "type": "timeseries",
          "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 },
          "targets": [
            { "expr": "sum(rate(http_requests_total{job=\"fifaapp-backend\"}[5m])) by (handler)" }
          ]
        },
        {
          "title": "p95 latency",
          "type": "timeseries",
          "gridPos": { "x": 12, "y": 0, "w": 12, "h": 8 },
          "targets": [
            { "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"fifaapp-backend\"}[5m])) by (le, handler))" }
          ]
        },
        {
          "title": "Error rate (5xx)",
          "type": "timeseries",
          "gridPos": { "x": 0, "y": 8, "w": 12, "h": 8 },
          "targets": [
            { "expr": "sum(rate(http_requests_total{job=\"fifaapp-backend\",status=~\"5..\"}[5m]))" }
          ]
        },
        {
          "title": "Pod memory",
          "type": "timeseries",
          "gridPos": { "x": 12, "y": 8, "w": 12, "h": 8 },
          "targets": [
            { "expr": "sum(container_memory_working_set_bytes{namespace=\"fifaapp\",pod=~\"fifaapp-backend.*\"}) by (pod)" }
          ]
        }
      ]
    }
```

This ConfigMap lives in `monitoring`, not `fifaapp` — it belongs to Grafana, not the app.

```bash
git add k8s/backend-dashboard-configmap.yaml
git commit -m "Add FifaApp backend Grafana dashboard"
git push
```

Refresh Grafana → **Dashboards** — "FifaApp Backend" appears within ~1 minute (sidecar
poll interval). Hit `/api/players` a few times from the frontend to see the request-rate
panel move.

---

## Troubleshooting

| Symptom | Cause | Fix |
|--|--|--|
| Prometheus target for backend shows no data | `ServiceMonitor` missing `release: monitoring` label | Add the label — Prometheus ignores unlabeled ServiceMonitors by chart default |
| `curl /metrics` works in-cluster but Prometheus still shows target down | Service port has no `name:` | ServiceMonitor's `endpoints[].port` matches by **port name**, not number |
| Dashboard never appears in Grafana | ConfigMap missing `grafana_dashboard: "1"` label, or in wrong namespace | Must be labeled and in the `monitoring` namespace — the sidecar only watches there |
| Pods pending after node bump | `desired_nodes` changed but TFC apply not yet run | Confirm & Apply in the TFC UI; check `kubectl get nodes` count |
| Prometheus pod `OOMKilled` | Default chart memory limits too low for a t3.medium cluster already running other workloads | This is why Step 3 sets explicit `resources.limits.memory` — raise it or reduce `desired_nodes` load elsewhere |

---

## Verify

- [ ] `kubectl get pods -n monitoring` shows Prometheus, Grafana, Alertmanager, node-exporter, kube-state-metrics all Running
- [ ] Prometheus **Status → Targets** shows `fifaapp-backend` as `UP`
- [ ] Grafana **Explore** returns data for `http_requests_total{job="fifaapp-backend"}`
- [ ] "FifaApp Backend" dashboard shows non-zero request rate after hitting the app

---

## Stuck? Check the solution
```
solutions/09-monitoring/
```

**Next:** Nothing — course complete. You've shipped an app through every stage from a
laptop `docker run` to a self-healing, GitOps-deployed, CI/CD-automated, monitored
Kubernetes service.
