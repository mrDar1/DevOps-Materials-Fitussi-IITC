# Monitoring HTTP Request Rate with `prometheus_http_requests_total`

Guide to inspecting Prometheus's own HTTP traffic using the `prometheus_http_requests_total` counter.

---

## 1. The Metric

```promql
prometheus_http_requests_total
```

A **counter** exposed by Prometheus itself. Counts every HTTP request served by the Prometheus server, broken down by:

- `handler` — endpoint hit (e.g. `/api/v1/query`, `/metrics`, `/-/healthy`).
- `code` — HTTP status code (`200`, `400`, `500`, …).

> 💡 **Tip:** Counters only ever increase. Never query them raw — wrap with `rate()`, `increase()`, or `irate()`.

---

## 2. Run the Query

In **Graph** tab, execute:

```promql
rate(prometheus_http_requests_total[5m])
```

### What it does

Returns **per-second average request rate** over the last 5 minutes, per `handler` + `code` combination.

### Expected output

```
{code="200", handler="/api/v1/query"}      0.4
{code="200", handler="/metrics"}           0.066
{code="200", handler="/-/healthy"}         0.033
{code="400", handler="/api/v1/query"}      0.0016
```

Interpretation: `/api/v1/query` serves ~0.4 req/s; small fraction of `400`s indicates malformed queries from clients.

---

## 3. Why Use `rate()`

| Function | Use case |
|----------|----------|
| `rate(x[5m])` | Smooth per-second average over window. Best for graphs/alerts. |
| `irate(x[5m])` | Instant rate from last 2 samples. Spiky — use for fast-moving counters. |
| `increase(x[5m])` | Total increase over window. Best for "how many requests in 5 min". |

> 💡 **Tip:** Window must be ≥ 4× scrape interval. Default scrape = 15s, so `[1m]` minimum, `[5m]` recommended.

---

## 4. Useful Variations

### Total request rate across all endpoints

```promql
sum(rate(prometheus_http_requests_total[5m]))
```

### Rate per endpoint

```promql
sum by (handler) (rate(prometheus_http_requests_total[5m]))
```

### Error rate only (4xx/5xx)

```promql
sum by (code) (rate(prometheus_http_requests_total{code=~"4..|5.."}[5m]))
```

### Top 5 hottest endpoints

```promql
topk(5, sum by (handler) (rate(prometheus_http_requests_total[5m])))
```

### Error ratio (errors / total)

```promql
sum(rate(prometheus_http_requests_total{code=~"5.."}[5m]))
/
sum(rate(prometheus_http_requests_total[5m]))
```

---

## 5. Health Indicators

| Pattern | Meaning |
|---------|---------|
| Stable rate, mostly `200` | Healthy. |
| Sudden spike on `/api/v1/query` | Dashboard or client polling aggressively. |
| Rising `5xx` rate | Server-side problem — check logs. |
| Rising `4xx` rate | Bad client queries — check Grafana/alert rules. |
| Rate drops to 0 | Prometheus unreachable or no clients querying. |

---

## 6. Alerting Example

Fire when 5xx error rate exceeds 1% over 5 min:

```yaml
- alert: PrometheusHighErrorRate
  expr: |
    sum(rate(prometheus_http_requests_total{code=~"5.."}[5m]))
      /
    sum(rate(prometheus_http_requests_total[5m]))
      > 0.01
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Prometheus serving >1% 5xx errors"
```

---

## Summary

- `prometheus_http_requests_total` → counter of HTTP requests served by Prometheus.
- Always wrap counters in `rate()` / `increase()` — never query raw.
- Use `sum by (handler)` to break down per endpoint.
- Filter `code=~"5.."` to track errors.
- Combine with `scrape_duration_seconds` and `up` for full self-monitoring view.
