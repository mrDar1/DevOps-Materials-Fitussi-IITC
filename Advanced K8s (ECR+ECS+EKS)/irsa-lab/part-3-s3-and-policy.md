# Part 3 — Create S3 Bucket and IAM Policy

## Create bucket

```bash
aws s3 mb s3://$BUCKET_NAME --region $AWS_REGION
```

## Upload a test file

```bash
echo "irsa test file" > test.txt
aws s3 cp test.txt s3://$BUCKET_NAME/test.txt
```

## Create IAM policy

Create `s3-access-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:GetObjectVersion"
      ],
      "Resource": [
        "arn:aws:s3:::REPLACE_BUCKET_NAME",
        "arn:aws:s3:::REPLACE_BUCKET_NAME/*"
      ]
    }
  ]
}
```

Replace bucket ARN, then create:

```bash
sed -i "s/REPLACE_BUCKET_NAME/$BUCKET_NAME/g" s3-access-policy.json

aws iam create-policy \
  --policy-name $POLICY_NAME \
  --policy-document file://s3-access-policy.json
```

## Capture policy ARN

```bash
export POLICY_ARN=arn:aws:iam::$ACCOUNT_ID:policy/$POLICY_NAME
echo $POLICY_ARN
```

Policy allows access ONLY to this bucket — not a blanket `s3:ListAllMyBuckets`.
