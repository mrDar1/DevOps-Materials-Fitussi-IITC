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
