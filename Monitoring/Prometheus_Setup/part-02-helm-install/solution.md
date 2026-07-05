# Part 2 — Solution

All outputs below were captured from a real run on minikube (chart `kube-prometheus-stack-87.10.1`, July 2026). Hash suffixes (`-6f775dcf77`, `-kxq24`, …) **will differ on your machine** — the base names won't.

## Step 1 — Verify clean state

```bash
kubectl config current-context
```

```text
minikube
```

```bash
kubectl get all
```

```text
NAME                 TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
service/kubernetes   ClusterIP   10.96.0.1    <none>        443/TCP   26d
```

Only the default API-server service → clean cluster. ✅

## Step 2 — Add repo + install

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

```text
"prometheus-community" has been added to your repositories
...Successfully got an update from the "prometheus-community" chart repository
Update Complete. ⎈Happy Helming!⎈
```

```bash
helm install prometheus prometheus-community/kube-prometheus-stack
```

```text
NAME: prometheus
LAST DEPLOYED: Sun Jul  5 03:05:33 2026
NAMESPACE: default
STATUS: deployed
REVISION: 1
DESCRIPTION: Install complete
NOTES:
kube-prometheus-stack has been installed. Check its status by running:
  kubectl --namespace default get pods -l "release=prometheus"

Get Grafana 'admin' user password by running:

  kubectl --namespace default get secrets prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d ; echo
```

The command returns in seconds — actual startup takes ~2 minutes.

> 💡 Keep those NOTES — the Grafana password command comes back in Part 6.

## Step 3 — Wait for pods

```bash
kubectl get pods
```

```text
NAME                                                     READY   STATUS    RESTARTS   AGE
alertmanager-prometheus-kube-prometheus-alertmanager-0   2/2     Running   0          91s
prometheus-grafana-6f775dcf77-kxq24                      3/3     Running   0          2m1s
prometheus-kube-prometheus-operator-5776cf897d-7vqvd     1/1     Running   0          2m1s
prometheus-kube-state-metrics-79ff744748-ff8z8           1/1     Running   0          2m1s
prometheus-prometheus-kube-prometheus-prometheus-0       2/2     Running   0          91s
prometheus-prometheus-node-exporter-4fnrx                1/1     Running   0          2m1s
```

All 6 pods Running and fully READY. ✅ (Note: the StatefulSet pods appear ~30s *after* the others — the Operator has to create them first.)

## Step 4 — `kubectl get all`

```text
NAME                                                         READY   STATUS    RESTARTS   AGE
pod/alertmanager-prometheus-kube-prometheus-alertmanager-0   2/2     Running   0          107s
pod/prometheus-grafana-6f775dcf77-kxq24                      3/3     Running   0          2m17s
pod/prometheus-kube-prometheus-operator-5776cf897d-7vqvd     1/1     Running   0          2m17s
pod/prometheus-kube-state-metrics-79ff744748-ff8z8           1/1     Running   0          2m17s
pod/prometheus-prometheus-kube-prometheus-prometheus-0       2/2     Running   0          107s
pod/prometheus-prometheus-node-exporter-4fnrx                1/1     Running   0          2m17s

NAME                                              TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)                      AGE
service/alertmanager-operated                     ClusterIP   None             <none>        9093/TCP,9094/TCP,9094/UDP   107s
service/kubernetes                                ClusterIP   10.96.0.1        <none>        443/TCP                      26d
service/prometheus-grafana                        ClusterIP   10.106.252.63    <none>        80/TCP                       2m17s
service/prometheus-kube-prometheus-alertmanager   ClusterIP   10.105.73.156    <none>        9093/TCP,8080/TCP            2m17s
service/prometheus-kube-prometheus-operator       ClusterIP   10.97.72.204     <none>        443/TCP                      2m17s
service/prometheus-kube-prometheus-prometheus     ClusterIP   10.101.215.232   <none>        9090/TCP,8080/TCP            2m17s
service/prometheus-kube-state-metrics             ClusterIP   10.99.148.170    <none>        8080/TCP                     2m17s
service/prometheus-operated                       ClusterIP   None             <none>        9090/TCP                     107s
service/prometheus-prometheus-node-exporter       ClusterIP   10.100.209.130   <none>        9100/TCP                     2m17s

NAME                                                 DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR            AGE
daemonset.apps/prometheus-prometheus-node-exporter   1         1         1       1            1           kubernetes.io/os=linux   2m17s

NAME                                                  READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/prometheus-grafana                    1/1     1            1           2m17s
deployment.apps/prometheus-kube-prometheus-operator   1/1     1            1           2m17s
deployment.apps/prometheus-kube-state-metrics         1/1     1            1           2m17s

NAME                                                             DESIRED   CURRENT   READY   AGE
replicaset.apps/prometheus-grafana-6f775dcf77                    1         1         1       2m17s
replicaset.apps/prometheus-kube-prometheus-operator-5776cf897d   1         1         1       2m17s
replicaset.apps/prometheus-kube-state-metrics-79ff744748         1         1         1       2m17s

NAME                                                                    READY   AGE
statefulset.apps/alertmanager-prometheus-kube-prometheus-alertmanager   1/1     107s
statefulset.apps/prometheus-prometheus-kube-prometheus-prometheus       1/1     107s
```

## Steps 5–9 — Reading the output

**StatefulSets (Step 5):**

```text
alertmanager-prometheus-kube-prometheus-alertmanager   1/1
prometheus-prometheus-kube-prometheus-prometheus       1/1
```

- `prometheus-prometheus-kube-prometheus-prometheus` = the **core Prometheus server** (the "three prometheus names chained": release `prometheus` + chart `kube-prometheus` + component `prometheus`). Created and managed **by the Operator**.
- `alertmanager-...` = the **Alertmanager** StatefulSet.

**Deployments (Step 6):**

```text
prometheus-grafana                    1/1
prometheus-kube-prometheus-operator   1/1
prometheus-kube-state-metrics         1/1
```

- Operator = the main one; it created both StatefulSets (same `kube-prometheus` prefix).
- Grafana = its own deployment.
- kube-state-metrics = chart **dependency**; scrapes K8s component health (Deployments/StatefulSets/Pods) for Prometheus → **cluster monitoring out of the box**.

**ReplicaSets (Step 7):** one per Deployment, same names + hash — just the underlying layer.

**DaemonSet (Step 8):**

```text
daemonset.apps/prometheus-prometheus-node-exporter   1  1  1  ...  kubernetes.io/os=linux
```

1 desired/current because minikube has **1 node**. node-exporter translates node metrics (CPU, load, …) into Prometheus format on **every** node.

**Services (Step 9):** one per component. The two extra headless ones (`prometheus-operated`, `alertmanager-operated`, CLUSTER-IP `None`) are created by the Operator for the StatefulSets — that's the operator-managed pattern again.

## Step 10 — Big picture

With one command you now have both the **monitoring stack** and **default monitoring of the cluster itself**: node stats (node-exporter) + Kubernetes objects (kube-state-metrics). Nothing was configured by hand.
