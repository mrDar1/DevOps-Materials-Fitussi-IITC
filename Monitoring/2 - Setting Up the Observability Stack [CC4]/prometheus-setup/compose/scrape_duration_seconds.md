# Verifying Prometheus with `scrape_duration_seconds`

Quick guide to validate Prometheus setup using the built-in `scrape_duration_seconds` metric.

---

## 1. Access the Prometheus Web UI

Open browser at:

```
http://localhost:9090
```

Confirm:

- UI loads without errors.
- Targets appear under **Status → Targets**.
- All targets report state `UP`.

> 💡 **Tip:** If target shows `DOWN`, check network reachability and the `scrape_configs` block in `prometheus.yml`.

---

## 2. Run Your First Query

In **Graph** tab, paste and click **Execute**:

```promql
scrape_duration_seconds
```

### What it does

Returns duration (seconds) of the **last scrape** per target. Useful for:

- Verifying scraping actually happens.
- Spotting slow targets.
- Diagnosing network or endpoint performance issues.

### Expected output

```
scrape_duration_seconds{instance="localhost:9090", job="prometheus"}   0.004924163
```

Interpretation: scrape of `localhost:9090` took ~**0.0049s** — fast, healthy.

> 📝 `scrape_duration_seconds` tells how long the last scrape took for each target.

---

## 3. Average Scrape Duration Over Time

Single-point values noisy. Smoothed view over last 5 min:

```promql
avg_over_time(scrape_duration_seconds[5m])
```

Adjust window (`[1m]`, `[10m]`, `[1h]`) to fit investigation.

> 💡 **Tip:** Use **Graph** view (not **Table**) to see trends. Spikes often map to target overload, GC pauses, or network blips.

---

## 4. Useful Follow-Up Queries

| Query | Purpose |
|-------|---------|
| `up` | `1` if target reachable, `0` otherwise. |
| `scrape_samples_scraped` | Samples returned per scrape. |
| `rate(prometheus_tsdb_head_samples_appended_total[1m])` | Ingestion rate. |
| `topk(5, scrape_duration_seconds)` | Top 5 slowest targets. |

---

## 5. Healthy vs. Unhealthy Indicators

| Value | Meaning |
|-------|---------|
| `< 0.1s` | Healthy. |
| `0.1s – 1s` | Acceptable; watch trend. |
| `> 1s` | Investigate — slow target or too many metrics. |
| Missing / `NaN` | Target unreachable. Check `up` and endpoint. |

---

## Summary

- `scrape_duration_seconds` → last scrape time per target.
- `avg_over_time(scrape_duration_seconds[5m])` → smoothed trend.
- Use **Graph** view for visual diagnosis.
- Combine with `up` and `scrape_samples_scraped` for full health picture.
