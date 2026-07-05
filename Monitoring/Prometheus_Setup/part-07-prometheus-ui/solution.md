# Part 7 — Solution

Captured live (Prometheus v3.13.0).

## Step 1 — Port-forward

```bash
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090
```

```text
Forwarding from 127.0.0.1:9090 -> 9090
Forwarding from [::1]:9090 -> 9090
```

Health check from the reference run:

```bash
curl -s http://localhost:9090/-/healthy
```

```text
Prometheus Server is Healthy.
```

UI reachable at `http://localhost:9090`. ✅

## Step 2 — Alerts

The Alerts tab lists the default alert rules — same ones as in the Part 5 rulefiles ConfigMap. Via API (equivalent evidence):

```bash
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups | length'
```

```text
35
```

35 rule groups loaded — matching `DATA 35` of the rulefiles ConfigMap. `Watchdog` shows as always-firing by design; most others green.

## Step 3 — Status → Configuration

Shows the rendered config — identical content to the decoded `prometheus.yaml.gz` Secret from Part 5 (`global: scrape_interval: 30s`, then `scrape_configs:` with one job per ServiceMonitor). Long and complex — expected.

## Step 4 — Status → Targets (real capture)

All 17 targets from the reference run, with health:

```text
serviceMonitor/default/prometheus-grafana/0                            -> up
serviceMonitor/default/prometheus-kube-prometheus-alertmanager/0       -> up
serviceMonitor/default/prometheus-kube-prometheus-alertmanager/1       -> up
serviceMonitor/default/prometheus-kube-prometheus-apiserver/0          -> up
serviceMonitor/default/prometheus-kube-prometheus-coredns/0            -> up
serviceMonitor/default/prometheus-kube-prometheus-kube-controller-manager/0 -> down
serviceMonitor/default/prometheus-kube-prometheus-kube-etcd/0          -> down
serviceMonitor/default/prometheus-kube-prometheus-kube-proxy/0         -> up
serviceMonitor/default/prometheus-kube-prometheus-kube-scheduler/0     -> down
serviceMonitor/default/prometheus-kube-prometheus-kubelet/0            -> up
serviceMonitor/default/prometheus-kube-prometheus-kubelet/1            -> up
serviceMonitor/default/prometheus-kube-prometheus-kubelet/2            -> up
serviceMonitor/default/prometheus-kube-prometheus-operator/0           -> up
serviceMonitor/default/prometheus-kube-prometheus-prometheus/0         -> up
serviceMonitor/default/prometheus-kube-prometheus-prometheus/1         -> up
serviceMonitor/default/prometheus-kube-state-metrics/0                 -> up
serviceMonitor/default/prometheus-prometheus-node-exporter/0           -> up
```

14 up, **3 down** — `kube-controller-manager`, `kube-etcd`, `kube-scheduler`: the expected minikube localhost-binding limitation ("some things down"). ✅

## Step 5 — Rules

Status → Rules shows the 35 groups (alertmanager.rules, node-exporter, kubelet.rules, …) being evaluated live.

## Step 7 — Cleanup (real run)

```bash
helm uninstall prometheus
```

```text
release "prometheus" uninstalled
```

```bash
kubectl delete crd alertmanagerconfigs.monitoring.coreos.com alertmanagers.monitoring.coreos.com \
  podmonitors.monitoring.coreos.com probes.monitoring.coreos.com prometheusagents.monitoring.coreos.com \
  prometheuses.monitoring.coreos.com prometheusrules.monitoring.coreos.com scrapeconfigs.monitoring.coreos.com \
  servicemonitors.monitoring.coreos.com thanosrulers.monitoring.coreos.com
```

```text
customresourcedefinition.apiextensions.k8s.io "alertmanagerconfigs.monitoring.coreos.com" deleted
... (10 deleted)
```

Verify:

```bash
kubectl get all
```

```text
NAME                 TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
service/kubernetes   ClusterIP   10.96.0.1    <none>        443/TCP   26d
```

```bash
kubectl get crd | grep monitoring
```

```text
(no output)
```

Cluster back to clean state. ✅
