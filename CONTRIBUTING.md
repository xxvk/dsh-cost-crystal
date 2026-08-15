# Contributing

## 源与生成物(先认清再动手)

| 手写源(唯一编辑入口) | 生成命令 | 生成物(禁止手改) |
|---|---|---|
| `src/scripts/card.inline.js`(浏览器注入脚本,纯 JS) | `npm run build` | `src/card-script.ts`(TS 模板字符串) |
| `src/scripts/cost.inline.js` | `npm run build` | `src/cost-script.ts` |
| `src/index.ts` / `src/pricing.ts` / `src/usage.ts`(Host 逻辑,TS) | `tsc` | `lib/*.js` |
| 以上所有 | `node scripts/build-profile.mjs` | `~/.dsh/profiles/web/plugins/ds-balance-vN.js` 等 |

注入脚本(浏览器端)的源是**纯 JS**(`.inline.js`)而非 TS:它们是运行时字符串(IIFE、无模块/类型/import),独立 `.js` 文件可直接 `node --check` 验证语法、测试直接提取纯函数求值;手写 `.ts` 模板则要手工转义 `\n`/反引号/`${`/`$`,反复引发"转义地狱"(见下)。Host 侧逻辑(`src/*.ts`)正常用 TypeScript。

**编辑规则**:改逻辑只动"手写源"列;`card-script.ts` / `lib/` / profile `ds-balance-vN.js` 一律由命令重新生成,严禁手改。

## 完成标准(每次修改的判定门槛)

**`npm test` 必须全绿才算完成**。它包含三关:

1. `tsc` 类型检查与构建
2. `node --test` 全部单元/回归测试
3. `node scripts/check-lines.mjs` 行数规则

CI(`.github/workflows/test.yml`)在 push/PR 时自动执行同样的门槛。

## 行数规则

| 文件类型 | 推荐 | 硬上限 | 违反时 |
|---|---|---|---|
| 源码 `src/**/*.ts` / `src/scripts/*.js` | ≤200 行 | 300 行 | `npm test` 报错 |
| 测试 `test/**/*.mjs` | ≤200 行 | 300 行 | `npm test` 报错 |
| 生成物 `lib/`、`dist/`、`node_modules` | — | 豁免 | — |

### 为什么生成物豁免

- `lib/` 由 `tsc` 按源码结构生成,行数镜像源码;对生成物设上限没有可维护性收益,只会逼着为"行数"做违背可读性的源码重构。
- 但规则的精神仍然适用:如果**产生大输出的源码**逼近 300 行,就应该拆分——注入脚本已按"每个脚本一个 `.inline.js` 文件"拆分(`src/scripts/card.inline.js`、`cost.inline.js`),Host 逻辑同理。

## CHANGELOG 规则

- 按 **0.1 版本**记录(`v0.1.0` → `v0.1.1` → …);每个 0.1 版本**最多 3 个重点更新**,保持简洁。
- 重点条目用一句概括(用户可感知的变化),细节进 issue/PR 描述,不进 changelog。
- 文档语言:README / TODO / ROADMAP 以**英文**为主,中文版放 `*_CN.md`(README_CN.md / TODO_CN.md / ROADMAP_CN.md)。

## TDD

- 新功能:先写失败测试 → 实现 → 全绿。
- 历史 bug 必须有回归测试(参考 `$` 注入破坏、`\n` 转义破坏的回归用例)。
- 注入脚本(字符串常量)的行为测试通过"从脚本中提取纯函数并求值"的方式做(见 `test/scripts.test.mjs`)。

## 实现注意(踩过的坑)

- 注入 index.html 必须用**字符串切片拼接**(`injectScript`),不能用 `String.replace`——替换串中的 `$&` / `$'` / `$$` 会被按正则语义展开,破坏含 `$` 的脚本。
- 模板字符串内嵌注入脚本时,脚本内的 `\n` 转义要写成 `\\n`,否则求值成真实换行会截断单引号字符串。
