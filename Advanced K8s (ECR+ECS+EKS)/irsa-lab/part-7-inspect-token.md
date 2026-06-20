# Part 7 — Inspect the Projected JWT Token

Verify the OIDC token the pod sends to AWS STS to assume the IRSA role.

> **Why the old method no longer works (Kubernetes 1.24+)**
> Before K8s 1.24, every ServiceAccount automatically got a permanent Secret
> (`irsa-service-account-token-xxxxx`) holding a non-expiring JWT, and you inspected that.
> Since **1.24** that auto-Secret is **gone** — `kubectl get secrets` shows nothing for the SA.
> Modern tokens are **short-lived and projected**: the kubelet injects a bound, auto-rotating
> JWT straight into the pod at `/var/run/secrets/eks.amazonaws.com/serviceaccount/token`.
> That projected token (audience `sts.amazonaws.com`) is exactly what IRSA uses — so we read it
> from inside the running pod.

## Read the projected token from the pod

The IRSA pod from Part 6 (`aws-cli`, using `irsa-service-account`) must be Running.

```bash
kubectl exec aws-cli -- cat /var/run/secrets/eks.amazonaws.com/serviceaccount/token
```

Copy the printed JWT (three base64url segments separated by `.`).

## Decode the JWT payload

```bash
TOKEN=$(kubectl exec aws-cli -- cat /var/run/secrets/eks.amazonaws.com/serviceaccount/token)

# decode the middle (payload) segment
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq
```

> `base64 -d` may complain about missing padding on some platforms; the `2>/dev/null` hides that
> and `jq` still parses the JSON. You can also paste `$TOKEN` into <https://jwt.io>.

## Check the payload

Confirm these claims:

- `iss` — your cluster OIDC issuer URL (`https://oidc.eks.<region>.amazonaws.com/id/...`)
- `aud` — `["sts.amazonaws.com"]`  ← the IRSA-specific audience
- `sub` — `system:serviceaccount:default:irsa-service-account`
- `kubernetes.io.serviceaccount.namespace` = `default`
- `kubernetes.io.serviceaccount.serviceaccount.name` = `irsa-service-account`

The `sub` MUST match the `Condition` in the IAM role trust policy (Part 4), and `aud` must be
`sts.amazonaws.com`. Same `sub` and `iss` end to end — that match is what makes federated
`AssumeRoleWithWebIdentity` succeed.

## Alternative: mint a token without exec'ing the pod

You can request an equivalent token directly from the TokenRequest API:

```bash
kubectl create token irsa-service-account --audience sts.amazonaws.com | \
  cut -d. -f2 | base64 -d 2>/dev/null | jq
```

Same `sub`/`aud`/`iss` claims — useful for inspection when no pod is running.
