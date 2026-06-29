resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  namespace        = "argocd"
  create_namespace = true
  version          = "7.7.11"

  depends_on = [module.eks]

  # Disable TLS on the ArgoCD server so port-forwarding works over plain HTTP.
  set {
    name  = "configs.params.server\\.insecure"
    value = "true"
  }
}
