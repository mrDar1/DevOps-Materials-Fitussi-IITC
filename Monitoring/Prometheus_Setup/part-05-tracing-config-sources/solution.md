# Part 5 — Solution

Saved artifacts from the reference run are in this folder: [secret.yaml](secret.yaml) and [rules-configmap.yaml](rules-configmap.yaml) (rules file truncated — regeneration command inside).

## Step 2 — Config mount → pod volume → Secret

From the Part 4 describe file, `Volumes:` section:

```text
Volumes:
 config:
  Type:        Secret (a volume populated by a Secret)
  SecretName:  prometheus-prometheus-kube-prometheus-prometheus
  Optional:    false
```

The `config` volume is a **Secret**, name `prometheus-prometheus-kube-prometheus-prometheus`. ✅

## Step 3 — Save + decode the Secret

```bash
kubectl get secret prometheus-prometheus-kube-prometheus-prometheus -o yaml > secret.yaml
```

`secret.yaml` (trimmed):

```yaml
apiVersion: v1
data:
  prometheus.yaml.gz: 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
kind: Secret
metadata:
  name: prometheus-prometheus-kube-prometheus-prometheus
  namespace: default
  labels:
    app.kubernetes.io/managed-by: prometheus-operator
  ownerReferences:
  - apiVersion: monitoring.coreos.com/v1
    kind: Prometheus
    name: prometheus-kube-prometheus-prometheus
type: Opaque
```

- The data key is **`prometheus.yaml.gz`** — the file name mounted into the pod, **base64-encoded because it's a Secret** (and gzipped in current chart versions).
- Note `ownerReferences: kind: Prometheus` — the Secret is generated and owned by the **Operator's** `Prometheus` custom resource (a CRD from Part 3!).

Decode:

```bash
kubectl get secret prometheus-prometheus-kube-prometheus-prometheus \
  -o jsonpath='{.data.prometheus\.yaml\.gz}' | base64 -d | gunzip | head -20
```

```yaml
global:
  scrape_interval: 30s
  external_labels:
    prometheus: default/prometheus-kube-prometheus-prometheus
    prometheus_replica: $(POD_NAME)
...
scrape_configs:
- job_name: serviceMonitor/default/prometheus-grafana/0
...
```

The decoded file has one `job_name` per scrape target — grafana, alertmanager, apiserver, coredns, kubelet, kube-state-metrics, node-exporter, prometheus itself, … **This is where you'd add a new scrape endpoint.** ✅

## Step 4 — Rules mount → ConfigMap

Pod `Volumes:` in the describe:

```text
prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0:
 Type:      ConfigMap (a volume populated by a ConfigMap)
 Name:      prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0
 Optional:  true
```

```bash
kubectl get configmap prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0 -o yaml > rules-configmap.yaml
```

`rules-configmap.yaml` (first rule file, trimmed):

```yaml
apiVersion: v1
data:
  default-prometheus-kube-prometheus-alertmanager.rules-13e5558e-....yaml: |
    groups:
    - name: alertmanager.rules
      rules:
      - alert: AlertmanagerFailedReload
        annotations:
          description: Configuration has failed to load for {{ $labels.namespace }}/{{ $labels.pod}}.
          summary: Reloading an Alertmanager configuration has failed.
        expr: |-
          max_over_time(alertmanager_config_last_reload_successful{job="prometheus-kube-prometheus-alertmanager",...}[5m]) == 0
        for: 10m
        labels:
          severity: critical
```

35 rule files in total (`DATA 35` from Part 3), containing the default **alert rules** — `AlertmanagerFailedReload`, `AlertmanagerMembersInconsistent`, `AlertmanagerClusterDown`, node rules, kubelet rules, and so on. ✅

## Step 5 — What to edit

| Goal | Object |
|------|--------|
| Add scrape endpoint | The config **Secret** (`prometheus.yaml`) — or, operator-style, a new `ServiceMonitor`/`ScrapeConfig` CR that the Operator renders **into** that Secret |
| Change alert rules | The rules — operator-style via `PrometheusRule` CRs, rendered into the rulefiles **ConfigMap** |

## Step 6 — Alertmanager, same pattern

From [../part-04-inspecting-containers/alertmanager.yaml](../part-04-inspecting-containers/alertmanager.yaml):

```text
Containers:
 alertmanager:
  Image: quay.io/prometheus/alertmanager:v0.33.1
  Args:
    --config.file=/etc/alertmanager/config_out/alertmanager.env.yaml
 config-reloader:
  Image: quay.io/prometheus-operator/prometheus-config-reloader:v0.92.1
Volumes:
 config-volume:
  Type:        Secret (a volume populated by a Secret)
  SecretName:  alertmanager-prometheus-kube-prometheus-alertmanager-generated
```

Own default **`alertmanager.yaml`** config (also from a Secret) + same reloader helper. ✅

## Step 7 — Operator

```text
Containers:
 kube-prometheus-stack:
  Image: quay.io/prometheus-operator/prometheus-operator:v0.92.1
  Args:
    --prometheus-config-reloader=quay.io/prometheus-operator/prometheus-config-reloader:v0.92.1
    ...
```

The orchestrator — it even carries the reloader image as an argument, because **it** injects those helper containers into the pods it manages. Everything is interconnected; you only need the two practical skills from Step 5.
