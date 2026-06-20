# Part 8 — Cleanup

Tear down everything to avoid charges.

## Delete the pod

```bash
kubectl delete -f myapp.yaml
```

## Delete IAM service account + role

```bash
eksctl delete iamserviceaccount \
  --name $SA_NAME \
  --namespace $NAMESPACE \
  --cluster $CLUSTER_NAME \
  --region $AWS_REGION
```

## Delete IAM policy

```bash
aws iam delete-policy --policy-arn $POLICY_ARN
```

## Empty and delete S3 bucket

```bash
aws s3 rm s3://$BUCKET_NAME --recursive
aws s3 rb s3://$BUCKET_NAME
```

## Delete OIDC provider (optional)

The OIDC provider ARN contains the cluster's **OIDC id** (the tail of the issuer URL), not the
cluster name — so match on that. Run this **before** deleting the cluster (it needs the cluster
to still exist to look up the issuer):

```bash
OIDC_ID=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION \
  --query "cluster.identity.oidc.issuer" --output text | sed 's#.*/id/##')

OIDC_ARN=$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[?contains(Arn, '$OIDC_ID')].Arn" \
  --output text)

echo "$OIDC_ARN"
# If empty, find the right ARN manually in IAM console → Identity providers.
aws iam delete-open-id-connect-provider --open-id-connect-provider-arn $OIDC_ARN
```

## Delete the cluster

```bash
eksctl delete cluster --name $CLUSTER_NAME --region $AWS_REGION
```

Confirm in console: EKS cluster, CloudFormation stacks, IAM role/policy, S3 bucket all gone.
