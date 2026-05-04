# Process Uptime with `time() - process_start_time_seconds`

Guide to measuring how long a process has been running using built-in Prometheus metrics.

---

## 1. The Building Blocks

| Expression | Meaning |
|------------|---------|
| `time()` | Current Unix timestamp (seconds since epoch) at query evaluation. |
| `process_start_time_seconds` | Unix timestamp when the target process started. Gauge, set once at startup. |

Subtract → seconds since process started.

---

## 2. Run the Query

```promql
time() - process_start_time_seconds
```

### What it does

Returns **uptime in seconds** for every instrumented target.

### Expected output

```
{instance="localhost:9090", job="prometheus"}      87432
{instance="node-exporter:9100", job="node"}        87401
{instance="app:8080", job="myapp"}                 312
```

Interpretation: Prometheus running ~24h; app restarted 5 min ago.

---

## 3. Convert Seconds → Human-Readable

Seconds hard to read. Divide:

| Query | Unit |
|-------|------|
| `(time() - process_start_time_seconds) / 60` | minutes |
| `(time() - process_start_time_seconds) / 3600` | hours |
| `(time() - process_start_time_seconds) / 86400` | days |

> 💡 **Tip:** Grafana stat panel has built-in `seconds → duration` formatter. Query in seconds, display as `1d 4h 22m`.

---

## 4. Useful Variations

### Detect recent restarts (uptime < 5 min)

```promql
(time() - process_start_time_seconds) < 300
```

Returns only targets restarted in last 5 minutes.

### Count of recently restarted processes

```promql
count((time() - process_start_time_seconds) < 300)
```

### Oldest running process

```promql
topk(1, time() - process_start_time_seconds)
```

### Restart detector (alternative)

```promql
changes(process_start_time_seconds[1h])
```

Counts how many times `process_start_time_seconds` value changed in last hour. Each change = restart.

---

## 5. Health Indicators

| Pattern | Meaning |
|---------|---------|
| Steadily increasing | Healthy. Process stable. |
| Resets to low value | Process restarted. |
| Frequent resets | Crash loop. Investigate. |
| Missing | Target down or not exposing `process_*` metrics. |

---

## 6. Alerting Examples

### Flapping process (restarted 3+ times in 1h)

```yaml
- alert: ProcessFlapping
  expr: changes(process_start_time_seconds[1h]) > 3
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "{{ $labels.job }}/{{ $labels.instance }} restarted {{ $value }} times in last hour"
```

### Just restarted

```yaml
- alert: ProcessRestarted
  expr: (time() - process_start_time_seconds) < 60
  for: 0m
  labels:
    severity: info
  annotations:
    summary: "{{ $labels.instance }} restarted"
```

---

## 7. Why Not Use `up`?

`up` only tells if Prometheus can scrape target right now. Doesn't reveal restarts between scrapes. `process_start_time_seconds` survives restarts — value changes, exposing event.

| Metric | Detects |
|--------|---------|
| `up` | Reachability now. |
| `time() - process_start_time_seconds` | Age of current process instance. |
| `changes(process_start_time_seconds[Xm])` | Restart count in window. |

Use all three together for full availability picture.

---

## Summary

- `time() - process_start_time_seconds` → process uptime in seconds.
- Divide by `60` / `3600` / `86400` for minutes/hours/days.
- Low value = recent restart.
- `changes(process_start_time_seconds[1h])` → restart counter.
- Combine with `up` for full health view.
