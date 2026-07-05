# Part 3 — Solution

Captured from the live minikube run (chart 87.10.1).

## Step 1 — ConfigMaps

```bash
kubectl get configmap
```

```text
NAME                                                           DATA   AGE
kube-root-ca.crt                                               1      26d
prometheus-grafana                                             1      2m17s
prometheus-grafana-config-dashboards                           1      2m17s
prometheus-kube-prometheus-alertmanager-overview               1      2m17s
prometheus-kube-prometheus-apiserver                           1      2m17s
prometheus-kube-prometheus-cluster-total                       1      2m17s
prometheus-kube-prometheus-controller-manager                  1      2m17s
prometheus-kube-prometheus-etcd                                1      2m17s
prometheus-kube-prometheus-grafana-datasource                  1      2m17s
prometheus-kube-prometheus-grafana-overview                    1      2m17s
prometheus-kube-prometheus-k8s-coredns                         1      2m17s
prometheus-kube-prometheus-k8s-resources-cluster               1      2m17s
prometheus-kube-prometheus-k8s-resources-multicluster          1      2m17s
prometheus-kube-prometheus-k8s-resources-namespace             1      2m17s
prometheus-kube-prometheus-k8s-resources-node                  1      2m17s
prometheus-kube-prometheus-k8s-resources-pod                   1      2m17s
prometheus-kube-prometheus-k8s-resources-workload              1      2m17s
prometheus-kube-prometheus-k8s-resources-workloads-namespace   1      2m17s
prometheus-kube-prometheus-kubelet                             1      2m17s
prometheus-kube-prometheus-namespace-by-pod                    1      2m17s
prometheus-kube-prometheus-namespace-by-workload               1      2m17s
prometheus-kube-prometheus-node-cluster-rsrc-use               1      2m17s
prometheus-kube-prometheus-node-rsrc-use                       1      2m17s
prometheus-kube-prometheus-nodes                               1      2m17s
prometheus-kube-prometheus-nodes-aix                           1      2m17s
prometheus-kube-prometheus-nodes-darwin                        1      2m17s
prometheus-kube-prometheus-persistentvolumesusage              1      2m17s
prometheus-kube-prometheus-pod-total                           1      2m17s
prometheus-kube-prometheus-prometheus                          1      2m17s
prometheus-kube-prometheus-proxy                               1      2m17s
prometheus-kube-prometheus-scheduler                           1      2m17s
prometheus-kube-prometheus-workload-total                      1      2m17s
prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0   35     107s
```

Reading it:

- ~30 ConfigMaps, all with the operator/chart prefix — configs for **all the different parts** (most are Grafana dashboard JSONs: `nodes`, `k8s-resources-pod`, `apiserver`, `scheduler`, …).
- **The default rules file** is the last one: `prometheus-prometheus-kube-prometheus-prometheus-rulefiles-0` with **DATA 35** — 35 rule files inside. You'll open it in Part 5.

## Step 2 — Secrets

```bash
kubectl get secret
```

```text
NAME                                                                                  TYPE                 DATA   AGE
alertmanager-prometheus-kube-prometheus-alertmanager                                  Opaque               1      2m18s
alertmanager-prometheus-kube-prometheus-alertmanager-cluster-tls-config               Opaque               1      108s
alertmanager-prometheus-kube-prometheus-alertmanager-generated                        Opaque               1      109s
alertmanager-prometheus-kube-prometheus-alertmanager-tls-assets-0                     Opaque               0      109s
alertmanager-prometheus-kube-prometheus-alertmanager-web-config                       Opaque               1      109s
prometheus-grafana                                                                    Opaque               3      2m18s
prometheus-kube-prometheus-admission                                                  Opaque               3      2m21s
prometheus-prometheus-kube-prometheus-prometheus                                      Opaque               1      108s
prometheus-prometheus-kube-prometheus-prometheus-thanos-prometheus-http-client-file   Opaque               1      108s
prometheus-prometheus-kube-prometheus-prometheus-tls-assets-0                         Opaque               1      108s
prometheus-prometheus-kube-prometheus-prometheus-web-config                           Opaque               1      108s
sh.helm.release.v1.prometheus.v1                                                      helm.sh/release.v1   1      2m26s
```

Reading it:

- `...tls-assets...`, `...tls-config`, `...admission` → **certificates**.
- `prometheus-grafana` (DATA 3) → **Grafana UI username/password** (admin-user, admin-password) — used in Part 6.
- `prometheus-prometheus-kube-prometheus-prometheus` → the **generated Prometheus config** — decoded in Part 5.
- `sh.helm.release.v1.prometheus.v1` → Helm's own record of the release.

## Step 3 — CRDs

```bash
kubectl get crd
```

```text
NAME                                        CREATED AT
alertmanagerconfigs.monitoring.coreos.com   2026-07-05T00:05:30Z
alertmanagers.monitoring.coreos.com         2026-07-05T00:05:30Z
podmonitors.monitoring.coreos.com           2026-07-05T00:05:31Z
probes.monitoring.coreos.com                2026-07-05T00:05:31Z
prometheusagents.monitoring.coreos.com      2026-07-05T00:05:31Z
prometheuses.monitoring.coreos.com          2026-07-05T00:05:32Z
prometheusrules.monitoring.coreos.com       2026-07-05T00:05:32Z
scrapeconfigs.monitoring.coreos.com         2026-07-05T00:05:32Z
servicemonitors.monitoring.coreos.com       2026-07-05T00:05:33Z
thanosrulers.monitoring.coreos.com          2026-07-05T00:05:33Z
```

10 custom resource definitions under `monitoring.coreos.com` — the resource types the **Operator** watches (`Prometheus`, `Alertmanager`, `ServiceMonitor`, `PrometheusRule`, …). This is the "more stuff to it" the stack ships beyond standard Kubernetes resources.

## Step 4 — Option-1 verdict

Workloads (Part 2) + ~30 ConfigMaps + 12 Secrets + 10 CRDs, all wired together in the right order — that's what you'd have to author and maintain by hand with deployment option 1. The chart already did it. ✅
