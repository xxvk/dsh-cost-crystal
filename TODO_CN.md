# TODO

英文版见 [TODO.md](TODO.md)。

## 发布 v0.1.0(已完成)

- [x] git commit + push(`0.1.0 RC`)
- [x] `npm publish`(dsh-cost-crystal@0.1.0)
- [x] 截图补进 README(`docs/card.png`)
- [x] `v0.1.0` tag + GitHub Release
- [x] 社区收录:PR #639(awesome-dsh-plugin)+ #212(awesome-deepseek-harness)
- [ ] 干净安装验证:`dsh plugin --profile <临时名> add dsh-cost-crystal`(需 dsh CLI)
- [x] 实测:发一条消息,确认动画 **2s 内点亮**(已验证)

### 发布管线(已配置)

- **Trusted Publishing(OIDC)**:打 `v*` tag 后 GitHub Actions 自动 `npm publish`,无需 token(`.github/workflows/publish.yml`)
- **手动兜底**:granular token `dsh-cost-crystal-publish`(bypass 2FA、all packages、90 天 → 2026-11-14 前重新生成)

## 暂停(已从 v0.1.0 移除)

- [ ] **本会话费用行**(统计条末尾「费用 ≈ ¥X.XX」):已从插件移除;代码保留在 `src/scripts/cost.inline.js` + `src/usage.ts`(sessionCost/computeCost/sessionCostWithSource),待后续版本调教后重新挂载。

## 功能待办 v0.2.0(VL 模型统计)

个人需求:作者同时使用收费 VL 模型(如阿里 qwen VL)。

- [ ] **model 切换三角形按钮**:deepseek(官方 API)label 旁,切换已配置的可并用收费模型(前提:配置了其他模型才显示)
- [ ] **VL 模型统计**:按模型分桶用量/费用(deepseek vs VL),卡片/费用行展示
- [ ] 多模型会话统计:费用与 token 按模型拆分
- [ ] VL 模型配置文档(如何添加 qwen VL 等)

## 功能待办 v0.3.0(预测深化)

- [ ] 下一条边际成本:滑动窗口加权、按消息类型(问/答)区分、输入→输出回归
- [ ] 今日预算烧尽预测(近 24h 速率外推)
- [ ] 波峰策略提示(临近波峰提醒低峰再跑大任务)
- [ ] 最贵请求 Top 列表
- [ ] 模型切换费用对比(同一请求跨模型)
- [ ] 预测的长上下文截断窗口

## 文档(延迟到 v0.2.0 发布)

- [ ] `docs/social-card*.md`(英/中/日宣传卡)保持未跟踪;0.2.0 发布时决定处理方式

## 工程待办(长期)

- [ ] 本地 profile 迁移到 `dsh plugin --profile web add` 单包管理(移除 ds-balance-vN / ds-session-cost-vN 手管行)
- [ ] README 补 CI 状态徽章
- [ ] 竞品巡检(`docs/reference-tracking.md` + `scripts/check-references.mjs`)通过 .gitignore 仅本地保留(iCloud 同步,远端不发布)
