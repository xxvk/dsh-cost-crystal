# AGENTS.md — dsh-cost-crystal 开发守则

> 本文件是本仓库的 **agent 工作守则**(人类完整文档见 [CONTRIBUTING.md](CONTRIBUTING.md))。
> 在修改本仓库代码前先读本文件;每次修改后必须通过**完成门槛**。

## 完成门槛(必须全绿才算完成)

```sh
npm test
```

= `tsc` 构建 + `node --test` 全部测试 + `node scripts/check-lines.mjs` 行数规则。
任何一项失败都不算完成。CI 在 push/PR 时执行同样门槛。

## 文件分层:源 vs 生成物(先认清再动手)

| 手写源(唯一编辑入口) | 生成命令 | 生成物(禁止手改) |
|---|---|---|
| `src/scripts/card.inline.js`(浏览器注入脚本,纯 JS) | `npm run build` | `src/card-script.ts`(TS 模板字符串) |
| `src/scripts/cost.inline.js` | `npm run build` | `src/cost-script.ts` |
| `src/index.ts` / `src/pricing.ts` / `src/usage.ts`(Host 逻辑,TS) | `tsc` | `lib/*.js` |
| 以上所有 | `node scripts/build-profile.mjs` | `~/.dsh/profiles/web/plugins/ds-balance-vN.js` 等 |

**为什么注入脚本的源是 `.js` 而不是 `.ts`**:注入脚本是运行时字符串(纯 JS IIFE,无模块/类型/import,浏览器按文本执行)。用独立 `.js` 文件当源,可直接 `node --check` 验证语法、测试直接正则提取纯函数求值;若改手写 `.ts` 模板,脚本内 `\n`/反引号/`${`/`$` 全要手工转义(见陷阱 2 的"转义地狱")。

**编辑规则**:改逻辑只动**手写源**那一列;`card-script.ts` / `lib/` / profile `ds-balance-vN.js` 都是生成物,一律由命令重新生成,严禁手改。

## 关键陷阱(踩过两次的坑,严禁再犯)

### 陷阱 1:注入必须用切片拼接,禁用 String.replace

`String.prototype.replace` **即使模式是字符串**,替换串中的 `$&` / `$'` / `$$` 也会被按正则语义展开:

- `$'` = 匹配位置之后的剩余文本 → 脚本里的 `'$'` 会被展开成整段 html 尾巴,脚本损坏。
- 只要**拼接/替换的内容含 `$`**(如 `'$' : b.currency`、`'($' + usd`),一律用 `indexOf + slice` 拼接,不要用 `String.replace`(除非把 `$` 写成 `$$`)。
- 参考 `src/index.ts` 的 `injectScript()`。**生成/重建脚本的代码同样适用此规则**——重建脚本自己踩过这个坑。

### 陷阱 2:注入脚本只编辑 inline.js,由生成器转义(禁止手写模板转义)

`src/scripts/card.inline.js` / `cost.inline.js` 是**纯 JS 源**(普通 JS,node --check 直接可验)。
`src/card-script.ts` / `cost-script.ts` 是**生成物**(`scripts/build-scripts.mjs` 程序化转义反斜杠/反引号/${,已接入 `npm run build`)。

- **编辑脚本内容只改 inline.js,禁止手改 .ts 模板**——手写转义层层叠加(`\n` 变 `\\n` 变 `\\\\n`...)曾反复引发"转义地狱"。
- 改完 inline.js 跑 `npm run build` 即重新生成;校验针对**求值后的脚本**(测试 build-scripts 回环:生成求值 === inline 源)。

### 陷阱 3:改完 profile 插件文件,模块被缓存

`~/.dsh/profiles/web/plugins/*.js` 被 Node 模块缓存,改内容不生效。热加载方法:**改名**(如 `ds-balance-v5.js` → `ds-balance-v6.js`)+ 更新 `~/.dsh/profiles/web/cordis.patch.yml` 对应行的 `name`,include 插件会自动重建。web 端口以 `DSH_WEB_URL` 环境变量为准(重启后可能变化)。

## 测试约定

- 注入脚本是字符串常量,无法直接 import 测行为:**从脚本文本正则提取纯函数 → `new Function` 求值 → 断言行为**(见 `test/scripts.test.mjs` 的 `pickCurrencies` / `usageText` 提取测试)。
- 历史 bug 必须带回归测试(陷阱 1、2 都有)。
- 新功能先写失败测试(TDD)→ 实现 → 全绿。

## 行数规则

- `src/**/*.ts` / `src/scripts/*.js` 与 `test/**/*.mjs`:理想 ≤200 行,硬上限 300 行(`npm test` 失败);到 300 就该动手拆(拆 plugin / 抽 helper),不要靠删注释、压缩来压线。
- 生成物 `lib/` / `dist/` / `node_modules` 豁免;注入脚本生成物 `src/card-script.ts` / `cost-script.ts` 亦豁免(由 build-scripts 生成,禁止手改);注入脚本按片段拆(`card.inline.js` 外壳 + `card-fmt.inline.js` 纯函数 + `card-render.inline.js` 渲染)。

## CHANGELOG 规则

- 按 **0.1 版本**记录;每个 0.1 版本**最多 3 个重点更新**,保持简洁(细节见 CONTRIBUTING.md)。
- 文档语言:README / TODO / ROADMAP 以**英文**为主,中文版放 `*_CN.md`。

## 发布/安装

- 用户安装:`dsh plugin --profile web add dsh-cost-crystal`(npm)或 `dsh plugin --profile web add "github:xxvk/dsh-cost-crystal"`。
- 包通过 `package.json` 的 `dsh.bundle.patch` 自动挂载到 profile;测试通过 `dsh plugin --profile <临时名> add <本地路径>` 验证。

### 陷阱 4:改完源码必须重新生成 profile 插件(build-profile)

本地 profile 的 `ds-balance-vN.js` 是**生成物**——`src/` 任何改动后,必须:
`npm run build && node scripts/build-profile.mjs`(生成新包装文件并更新 patch 行)。
**严禁手工改 profile 插件文件**——手工同步曾静默失败导致 host 代码漂移(handler 引用不存在的函数)。
改完 build-profile 会清 `require.cache` 并触发 include 热加载,无需手动改名。
**路由注册必须容错**(`registerRoute` try/catch):路径可能被并存插件占用(如 profile 里 ds-balance 与 ds-session-cost 都注册 /ds-session-cost),一个 duplicate 会中断 apply、丢失后续 tap——卡片/费用注入就没了。
