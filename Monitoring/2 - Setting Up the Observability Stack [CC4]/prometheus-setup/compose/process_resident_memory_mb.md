# Monitoring Process Memory with `process_resident_memory_bytes`

Guide to inspecting resident memory (RSS) of Prometheus and other instrumented processes.

---

## 1. The Metric

```promql
process_resident_memory_bytes
```

A **gauge** exposed by every process using the Prometheus client libraries (Go, Python, Java, Node, …). Reports current **RSS** (Resident Set Size) — physical RAM held by the process — in **bytes**.

> 💡 **Tip:** RSS includes shared libraries and memory-mapped files. Not always the same as "heap usage".

---

## 2. Convert Bytes → Megabytes

Bytes hard to read. Divide twice by 1024:

```promql
process_resident_memory_bytes / 1024 / 1024
```

Result: memory in **MiB** per target.

### Expected output

```
{instance="localhost:9090", job="prometheus"}   85.3
{instance="node-exporter:9100", job="node"}     12.7
```

Interpretation: Prometheus process holds ~85 MiB RAM; node-exporter ~13 MiB.

> 💡 **Tip:** `1024 / 1024` = MiB (binary). Use `/ 1e6` if you want MB (decimal). Most ops people use MiB.

---

## 3. Cleaner Alternatives

### Convert to GiB

```promql
process_resident_memory_bytes / 1024 / 1024 / 1024
```

### Use scalar suffix

```promql
process_resident_memory_bytes / (1024 * 1024)
```

Same result, single division — easier to read.

---

## 4. Useful Variations

### Memory per job (sum across instances)

```promql
sum by (job) (process_resident_memory_bytes) / 1024 / 1024
```

### Top 5 hungriest processes

```promql
topk(5, process_resident_memory_bytes / 1024 / 1024)
```

### Memory growth rate (MiB/sec)

```promql
rate(process_resident_memory_bytes[5m]) / 1024 / 1024
```

Detects leaks. Steady positive rate = memory climbing without release.

### Memory delta over last hour

```promql
(process_resident_memory_bytes - process_resident_memory_bytes offset 1h) / 1024 / 1024
```

---

## 5. Related Process Metrics

| Metric | Meaning |
|--------|---------|
| `process_virtual_memory_bytes` | Virtual address space size. Usually huge — not actual RAM. |
| `process_cpu_seconds_total` | Total CPU time consumed (counter — wrap with `rate()`). |
| `process_open_fds` | Open file descriptors. |
| `process_max_fds` | FD soft limit. |
| `process_start_time_seconds` | Unix timestamp of process start. |

### CPU usage % (single core)

```promql
rate(process_cpu_seconds_total[5m]) * 100
```

### FD usage ratio

```promql
process_open_fds / process_max_fds
```

Alert if > 0.8.

---

## 6. Health Indicators

| Pattern | Meaning |
|---------|---------|
| Flat line | Stable. Healthy. |
| Slow climb, never drops | Possible memory leak. |
| Sawtooth | Normal GC behavior (Go, Java). |
| Sudden spike | Heavy query, large scrape, or compaction. |
| Drop to 0 | Process restarted. |

---

## 7. Alerting Example

Fire when Prometheus RSS exceeds 1 GiB for 10 min:

```yaml
- alert: PrometheusHighMemory
  expr: process_resident_memory_bytes{job="prometheus"} / 1024 / 1024 / 1024 > 1
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Prometheus RSS > 1 GiB"
    description: "{{ $labels.instance }} using {{ $value }} GiB RAM"
```

---

## Summary

- `process_resident_memory_bytes` → physical RAM held by process (gauge).
- Divide by `1024 / 1024` → MiB for human reading.
- Use `rate()` to detect leaks.
- Combine with `process_cpu_seconds_total` and `process_open_fds` for full process health.
- Available on every Prometheus client lib — works for app code too.
