# Part 6 — Solution

Captured live (Grafana 13.1.0 from chart 87.10.1).

## Step 1 — Services are ClusterIP

```bash
kubectl get service
```

```text
NAME                                      TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)
alertmanager-operated                     ClusterIP   None             <none>        9093/TCP,9094/TCP,9094/UDP
prometheus-grafana                        ClusterIP   10.106.252.63    <none>        80/TCP
prometheus-kube-prometheus-alertmanager   ClusterIP   10.105.73.156    <none>        9093/TCP,8080/TCP
prometheus-kube-prometheus-operator       ClusterIP   10.97.72.204     <none>        443/TCP
prometheus-kube-prometheus-prometheus     ClusterIP   10.101.215.232   <none>        9090/TCP,8080/TCP
prometheus-kube-state-metrics             ClusterIP   10.99.148.170    <none>        8080/TCP
prometheus-prometheus-node-exporter       ClusterIP   10.100.209.130   <none>        9100/TCP
```

Every TYPE = **ClusterIP**, every EXTERNAL-IP = `<none>` → internal only; production answer = Ingress. ✅

## Step 2 — Grafana port + user from logs

```bash
kubectl logs deployment/prometheus-grafana -c grafana
```

Relevant lines:

```text
logger=settings ... msg="Config overridden from Environment variable" var="GF_SECURITY_ADMIN_USER=admin"
logger=settings ... msg="Config overridden from Environment variable" var="GF_SECURITY_ADMIN_PASSWORD=*********"
logger=http.server ... msg="HTTP Server Listen" address=[::]:3000 protocol=http subUrl= socket=
```

Port **3000**, user **admin** (password masked in logs → next step). Without `-c grafana`, kubectl errors with a list of the pod's containers to choose from.

## Step 3 — Admin password

```bash
kubectl get secret prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d ; echo
```

```text
KfznQ4RCJl2Cc6QSiZZA1o96iBucuZTIHU80fxfO
```

Random per-install — yours **will differ**. (Older charts: fixed `prom-operator` from the chart values.)

## Step 4 — Port-forward + login

```bash
kubectl port-forward deployment/prometheus-grafana 3000
```

```text
Forwarding from 127.0.0.1:3000 -> 3000
Forwarding from [::1]:3000 -> 3000
```

Verification of the reference run (local port 3000 was busy, so `3001:3000` was used — the ⚠️ case from the lab):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/login   # → 200
curl -s http://localhost:3001/login | grep -o '<title>[^<]*</title>'   # → <title>Grafana</title>
curl -s http://localhost:3001/api/health
```

```json
{
  "database": "ok",
  "version": "13.1.0"
}
```

Login page up, login `admin` + Step 3 password works. ✅

## Steps 5–6 — Dashboards

In **Dashboards** you find the pre-provisioned list (these are the ~30 dashboard ConfigMaps from Part 3):

- **Node Exporter / Nodes** — minikube node CPU/memory; instance dropdown shows the node IP:

  ```bash
  kubectl get nodes -o wide
  ```

  ```text
  NAME       STATUS   ROLES           AGE   VERSION   INTERNAL-IP    ...
  minikube   Ready    control-plane   26d   v1.35.1   192.168.58.2   ...
  ```

  Same `192.168.58.2` appears as the node-exporter instance in the dashboard. ✅

- **Kubernetes / Compute Resources / Pod (Namespace, Workload…)** — kube-state-metrics data; choose namespace `default` and any stack pod → CPU, memory, bandwidth.
- **Kubernetes / Scheduler, API server, CoreDNS, Proxy, etcd** — master processes.
- **Prometheus / Overview** — Prometheus scraping itself.

More panels will appear here automatically once new scrape endpoints are added (the later exporter demo).
