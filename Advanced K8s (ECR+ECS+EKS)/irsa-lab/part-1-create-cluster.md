# Part 1 — Create EKS Cluster

## Cluster config file

Create `eks-cluster-irsa.yml`:

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: eks-cluster-irsa
  region: us-east-1        # must match $AWS_REGION from Part 0
  version: "1.34"          # EKS 1.22 is end-of-life and can no longer be created

managedNodeGroups:
  - name: eks-workers-irsa
    instanceType: t3.medium
    privateNetworking: true
    desiredCapacity: 1
    minSize: 1
    maxSize: 1
    volumeSize: 10
    labels:
      nodegroup-type: eks-workloads-irsa
    tags:
      nodegroup-role: worker
    ssh:
      allow: false
```

## Create the cluster

```bash
eksctl create cluster -f eks-cluster-irsa.yml
```

Takes ~15 min.

## Verify

```bash
kubectl get nodes
aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION \
  --query "cluster.identity.oidc.issuer" --output text
```

The second command prints the OIDC issuer URL. Cluster is an OIDC provider by default.
