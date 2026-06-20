# Part 6 — Test Pod WITH IRSA (Expect Success)

Now attach the service account → pod assumes the S3 role.

## Update pod manifest

Edit `myapp.yaml`, add `serviceAccountName` under `spec`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: aws-cli
  namespace: default
spec:
  serviceAccountName: irsa-service-account
  containers:
    - name: aws-cli
      image: amazon/aws-cli:latest
      command: ["sleep", "3600"]
```

## Apply and wait

```bash
kubectl apply -f myapp.yaml
kubectl get po -w
```

Wait for `Running`.

## Exec and verify

```bash
kubectl exec -it aws-cli -- bash
```

Inside the pod:

```bash
aws sts get-caller-identity
```

ARN now shows `assumed-role/s3-access-role/...`.

```bash
aws s3 ls
```

Still **`AccessDenied`** — blanket list-all-buckets is not in the policy.

```bash
aws s3 ls s3://BUCKET_NAME/
```

**Works** — lists `test.txt`. Policy scopes access to this bucket only.

## Confirm injected env vars

```bash
env | grep AWS
```

Should show:
- `AWS_ROLE_ARN=arn:aws:iam::<account>:role/s3-access-role`
- `AWS_WEB_IDENTITY_TOKEN_FILE=/var/run/secrets/eks.amazonaws.com/serviceaccount/token`

These two vars confirm IRSA is active. Exit:

```bash
exit
```
