# dsh-cost-crystal 💎

A cost & usage crystal ball for the DeepSeek Harness web GUI — balance, real-time rate, peak/off-peak billing, and a 🔮 next-message cost forecast, all timezone-aware.

中文说明见 [README_CN.md](README_CN.md)。

![CI](https://github.com/xxvk/dsh-cost-crystal/actions/workflows/test.yml/badge.svg)

## Screenshot

![dsh-cost-crystal balance card](docs/card.png)

## Features

- **🔮 Next-message cost forecast** — estimates the token usage and cost of your next message from the current conversation context and historical usage; re-prices instantly when you switch models
- **Balance card** — CNY/USD balance with data-freshness hints («just now / Ns ago»); click to refresh instantly
- **Real-time rate** — the breathing dot and shimmer light up within 2s of token consumption, showing live `tok/s`
- **Peak/off-peak billing** — status badge, countdown to the next rate switch, and a last-24h spend estimate
- **Plug & play** — zero runtime dependencies, dark/light theme aware, API key stays on the Host

## Installation

Requires the DeepSeek Harness `web` profile (`@deepseek-ai/dsh`).

```sh
# Option 1 (recommended): npm package
dsh plugin --profile web add dsh-cost-crystal

# Option 2: from GitHub
dsh plugin --profile web add "github:xxvk/dsh-cost-crystal"

# Option 3: local development
dsh plugin --profile web add /path/to/dsh-cost-crystal
```

Then restart `dsh web` and hard-refresh the browser. The package declares `dsh.bundle`, so `dsh plugin` mounts it into the profile's bundle layer automatically — no manual config.

## Pricing & Timezone

- Pricing engine implements the official DeepSeek policy timeline: model-aware unit prices, peak/off-peak/flat buckets, dual currency (CNY/USD).
- Peak (deepseek-v4-flash etc.): hit $0.014 / miss $0.44 / output $1.32 per M tokens; off-peak at half price. Windows `01:00–04:00` and `06:00–10:00 UTC`.
- Windows are defined in UTC; state/price judged in UTC; **display** uses the browser's local timezone.
- Spend/cost covers **local Harness sessions only**; display conversion uses a fixed rate of 7.1.
- ⚠️ All spend/cost figures are **local-log estimates** and may differ from the official bill.

## VL models (multi-model stats)

dsh-cost-crystal buckets usage **per model** automatically from session logs, so mixed DeepSeek + vision-language (VL) usage shows side by side on the card. When more than one model is present, a summary line (`deepseek 12.5M · ¥36.6  qwen3-vl 1.2M · ¥3.2`) appears, and the **▼ button** next to the source label cycles through your configured models.

To use a VL model (e.g. Alibaba qwen3-vl-flash), configure it as a DSH provider — for example via the [dsh-vision-router](https://github.com/ysr666/dsh-vision-router) plugin (provider `vision-http`, model `aliyun/qwen3-vl-flash`, `DASHSCOPE_API_KEY` in `~/.dsh/.credentials.yaml`). dsh-cost-crystal needs no extra config: it reads whatever models the session log records.

## Roadmap

- v0.1.0 (now): balance card + real-time rate + peak/off-peak + countdown + 24h spend + 🔮 next-message forecast
- v0.2.0 (planned): **VL model statistics** — model-switch button + per-model cost/token buckets
- v0.3.0 (planned): forecast deepening — weighted window, budget burn-down, peak hints, top requests

See [ROADMAP.md](ROADMAP.md) and [TODO.md](TODO.md).

## Development

```sh
npm install           # only typescript devDependency
npm run build         # generate injected-script templates + tsc → lib/
npm test              # build + all tests + line rules (TDD gate)
npm run build:profile # generate local hot-reload profile plugin (dev)
```

Architecture: **Host logic** (`src/index.ts` / `src/pricing.ts` / `src/usage.ts`) is TypeScript; **injected scripts** are plain-JS sources (`src/scripts/card.inline.js` + `card-fmt.inline.js` + `card-render.inline.js`) escaped into generated `src/card-script.ts` by `scripts/build-scripts.mjs` (generated files: never hand-edit).

## Testing (TDD gate)

**Every code change must pass to be "done":**

```sh
npm test    # = tsc build + node --test (all tests) + check-lines
```

- Node built-in `node:test`, zero runtime deps; CI (`.github/workflows/test.yml`) runs on push/PR
- Line rules: `src`/`test` ideal ≤200 / hard cap 300; generated `lib/` exempt. See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[Apache-2.0](LICENSE)
