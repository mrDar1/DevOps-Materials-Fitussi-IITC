# Part 4 — Create IAM Role and Service Account

## Create role + service account in one command

`eksctl` creates the IAM role, builds the trust relationship, AND creates the K8s service account with the role-arn annotation.

```bash
eksctl create iamserviceaccount \
  --name $SA_NAME \
  --namespace $NAMESPACE \
  --cluster $CLUSTER_NAME \
  --region $AWS_REGION \
  --role-name $ROLE_NAME \
  --attach-policy-arn $POLICY_ARN \
  --approve
```

## Verify service account

```bash
kubectl get sa -n $NAMESPACE
kubectl get sa $SA_NAME -n $NAMESPACE -o yaml
```

Check `metadata.annotations` contains:

```
eks.amazonaws.com/role-arn: arn:aws:iam::<account>:role/s3-access-role
```

Without this annotation IRSA will not work.

## Verify role trust relationship

```bash
aws iam get-role --role-name $ROLE_NAME \
  --query "Role.AssumeRolePolicyDocument" --output json
```

Confirm:
- Principal `Federated` = your cluster OIDC provider ARN
- Action = `sts:AssumeRoleWithWebIdentity`
- Condition `sub` = `system:serviceaccount:default:irsa-service-account`
- Condition `aud` = `sts.amazonaws.com`

The `sub` value MUST match `system:serviceaccount:<namespace>:<sa-name>` exactly. Mismatch here = #1 cause of broken IRSA.
