# Part 2 — Associate OIDC Provider with IAM

## Inspect the OIDC config (optional)

```bash
ISSUER=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION \
  --query "cluster.identity.oidc.issuer" --output text)

curl -s $ISSUER/.well-known/openid-configuration | jq
```

Returns JSON with `issuer`, `jwks_uri`, `authorization_endpoint`.

## Associate the IAM OIDC provider

```bash
eksctl utils associate-iam-oidc-provider \
  --cluster $CLUSTER_NAME \
  --region $AWS_REGION \
  --approve
```

## Verify

```bash
aws iam list-open-id-connect-providers
```

The provider ID should match the tail of your cluster OIDC issuer URL. Confirm in IAM console → Identity providers.
