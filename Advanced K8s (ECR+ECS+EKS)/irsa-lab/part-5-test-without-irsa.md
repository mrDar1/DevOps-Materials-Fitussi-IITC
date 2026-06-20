# Part 5 — Test Pod WITHOUT IRSA (Expect Denied)

Baseline: pod with NO service account assumes the node IAM role → no S3 access.

## Pod manifest

Create `myapp.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: aws-cli
  namespace: default
spec:
  containers:
    - name: aws-cli
      image: amazon/aws-cli:latest
      command: ["sleep", "3600"]
```

No `serviceAccountName` — runs as `default` SA.

## Apply and wait

```bash
kubectl apply -f myapp.yaml
kubectl get po -w
```

Wait for `Running`.

## Exec and check identity

```bash
kubectl exec -it aws-cli -- bash
```

Inside the pod:

```bash
aws sts get-caller-identity
```

ARN shows the **node group instance role** (`assumed-role/eksctl-...-NodeInstanceRole`).

```bash
aws s3 ls s3://BUCKET_NAME/
```

Result: **`AccessDenied`**. Expected — node role has no S3 permission.

Exit and delete:

```bash
exit
kubectl delete -f myapp.yaml
```
