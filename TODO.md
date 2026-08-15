# TODO

中文版见 [TODO_CN.md](TODO_CN.md)。

## Release v0.1.0 (done)

- [x] git commit + push (`0.1.0 RC`)
- [x] `npm publish` (dsh-cost-crystal@0.1.0)
- [x] Screenshot in README (`docs/card.png`)
- [x] `v0.1.0` tag + GitHub Release
- [x] Community listings: PR #639 (awesome-dsh-plugin) + #212 (awesome-deepseek-harness)
- [ ] Clean install check: `dsh plugin --profile <temp> add dsh-cost-crystal` (needs dsh CLI)
- [x] Live check: send a message, confirm animation lights up **within 2s** (verified)

### Publish pipeline (configured)

- **Trusted Publishing (OIDC)**: `npm publish` via GitHub Actions on `v*` tag — no token needed (`.github/workflows/publish.yml`)
- **Manual fallback**: granular token `dsh-cost-crystal-publish` (bypass 2FA, all packages, 90d → re-create before 2026-11-14)

## Suspended (removed from v0.1.0)

- [ ] **Per-session cost line** (「费用 ≈ ¥X.XX」in chat stats bar): removed from the plugin; code preserved in `src/scripts/cost.inline.js` + `src/usage.ts` (sessionCost/computeCost/sessionCostWithSource) for a future version to refine and re-mount.

## Features v0.2.0 (VL model statistics)

Personal need: user also uses paid VL models (e.g. Alibaba qwen VL).

- [ ] **Model-switch triangle button** next to the DeepSeek (official API) label — cycles through configured co-usable paid models (only when other models are configured)
- [ ] **VL model statistics**: per-model usage/cost buckets (DeepSeek vs VL), shown in card / cost line
- [ ] Multi-model session stats: split cost & tokens by model
- [ ] VL model config documentation (how to add qwen VL etc.)

## Features v0.3.0 (prediction deepening)

- [ ] Next-message marginal cost: sliding-window weighted averages, type-aware (question/answer), input→output regression
- [ ] Daily budget burn-down (extrapolate remaining balance from last-24h rate)
- [ ] Peak-avoidance hints (warn before peak window; suggest running big jobs off-peak)
- [ ] Top-expensive requests list
- [ ] Model switch cost comparison (same request across models)
- [ ] Long-context truncation window for prediction

## Engineering (long-term)

- [ ] Migrate local profile to `dsh plugin --profile web add` single-package management (drop hand-managed ds-balance-vN / ds-session-cost-vN rows)
- [ ] Add CI status badge to README
- [ ] Peer audit (`docs/reference-tracking.md` + `scripts/check-references.mjs`) kept local-only via .gitignore (iCloud sync, not in remote)
