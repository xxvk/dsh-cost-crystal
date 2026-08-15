# Roadmap

中文版见 [ROADMAP_CN.md](ROADMAP_CN.md)。

## v0.1.0 (current · 2026-08)

Cost-tide **observation**: see the balance, the rate, the billing window — know "what state are we in".

- Balance card (breathing dot / data freshness / real-time rate / peak-off-peak / countdown / 24h spend)
- Per-session cost line (flat/peak/off-peak breakdown)
- Real-time rate: projection delta detection, animation within 2s
- Official-policy pricing engine (model-aware, peak/off-peak, dual currency)
- 🔮 Next-message prediction (v0.2 preview): context length + historical averages → tokens & cost

## v0.2.0 (planned · VL models)

Multi-model **statistics**: cover paid VL models (e.g. Alibaba qwen VL) alongside DeepSeek.

- Model-switch triangle button next to the DeepSeek label (cycles configured paid models)
- Per-model usage/cost buckets (DeepSeek vs VL) in card / cost line
- Multi-model session stats (cost & tokens split by model)
- VL model config docs

## v0.3.0 (planned · prediction deepening)

- Sliding-window weighted averages, message-type-aware, input→output regression
- Daily budget burn-down (extrapolate remaining balance from last-24h rate)
- Peak-avoidance hints (warn before peak window)
- Top-expensive requests
- Model switch cost comparison
- Long-context truncation window for prediction

## Future

- Multi-account / multi-key switching
- Dynamic exchange rate (currently fixed 7.1)
- Monthly/weekly spend report export
- Usage alerts (threshold notifications)

## Principles

- Every prediction is a **local-log estimate**, uncertainty stated explicitly, never bound to the official bill
- Stay lightweight: new features add **no runtime dependencies** (zero-dep plugin)
- TDD gate unchanged: `npm test` all green counts as done
