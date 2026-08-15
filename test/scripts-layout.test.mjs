// 卡片脚本测试(自动拆分自 scripts.test.mjs)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARD_SCRIPT } from '../lib/scripts.js'

function jsOf(raw) {
  const js = raw.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.length > 100, '脚本不应为空')
  return js
}
test('回归:近24h 与余额同处一行(amtrow),不再有独立双币种行', () => {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.includes('ds-balance-card__amtrow'), '应存在余额+24h 的统一行容器')
  assert.ok(js.includes("'近24h '"), '24h 文本应拼进统一行')
  assert.ok(!js.includes('近24h ≈'), '旧的独立双币种格式应移除')
  assert.ok(!js.includes("'($' + u.usd"), '不应再出现双币种并列')
})

// ── 卡片布局:去掉充值/赠送行,波峰下加分割线(预测模块预留位) ──────────

test('布局:充值/赠送明细行已移除(sub 类与 forEach 渲染不存在)', () => {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(!js.includes('ds-balance-card__sub'), '不应再有 sub 明细行')
  assert.ok(!js.includes("' 充值 ' + t.text"), '不应再渲染 充值/赠送 行')
})

test('布局:充值/赠送信息保留在主金额悬浮提示里(不占行)', () => {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.includes('充值 ') && js.includes('赠送 '), '主金额 title 应含 充值/赠送 信息')
  assert.ok(js.includes("amtSpan.title"), '应设置主金额 title')
})

test('布局:波峰行下方有分割线元素(预测模块预留位)', () => {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.includes('ds-balance-card__divider'), '应包含分割线元素')
  assert.ok(js.includes("'ds-balance-card__divider'"), '应渲染分割线 div')
})

// ── 余额标签:金额前加「余额」小字说明(同一行) ──────────────────────────

test('布局:余额金额前有「余额」小标签', () => {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.includes('ds-balance-card__amtlabel'), '应有余额标签样式类')
  assert.ok(js.includes("'余额'"), '应渲染 余额 文字')
  const iLabel = js.indexOf("'余额'")
  const iAmt = js.indexOf("'ds-balance-card__amt'")
  assert.ok(iLabel !== -1 && iAmt !== -1, '标签与金额 span 都应存在')
  assert.ok(iLabel < iAmt, '余额标签应声明在金额 span 之前(同一行前端)')
})

// ── 来源标签:DeepSeek 后显示模型来源(官方 API / 网关路由) ──────────────

function extractSourceLabel() {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  const m = js.match(/function sourceLabel\(provider\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 sourceLabel 函数')
  return new Function(`return (${m[0]})`)()
}

test('来源标签:官方 provider 显示「官方 API」', () => {
  assert.equal(extractSourceLabel()('deepseek-official'), '官方 API')
})

test('来源标签:其它 provider(网关/本机/OpenRouter 路由)原样显示', () => {
  const f = extractSourceLabel()
  assert.equal(f('openai'), 'openai')
  assert.equal(f('local-model'), 'local-model')
})

test('来源标签:head 中渲染来源 tag,带模型悬浮提示', () => {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.includes('ds-balance-card__src'), '应有来源标签样式类')
  assert.ok(js.includes('sourceLabel(data.source.provider)'), '应调用 sourceLabel 渲染')
  assert.ok(js.includes("'模型: '"), '来源 tag 应含模型悬浮提示')
})

// ── 呼吸灯 + 拖动 + 速率行(借鉴 dsh-token-panel) ──────────────────────

function extractPulseDuration() {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  const m = js.match(/function pulseDuration\(tps\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 pulseDuration 函数')
  return new Function(`return (${m[0]})`)()
}

test('呼吸灯:脉动频率随 tps 分级(越快越短)', () => {
  const f = extractPulseDuration()
  assert.ok(f(500) < f(50), '高速应更快')
  assert.ok(f(50) < f(5), '中速应快于低速')
  assert.ok(f(500) >= 0.5 && f(5) <= 2.5, '时长应在合理区间')
})

test('呼吸灯:使用鲸鱼蓝并含运行动画,不再用绿色', () => {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.includes('ds-balance-card__dot--active'), '应有运行动画类')
  assert.ok(/[#]?4D6BFE/i.test(js), '应使用鲸鱼蓝 4D6BFE')
  assert.ok(js.includes('@keyframes dsCardPulse'), '应有呼吸动画关键帧')
  // 圆点规则不用绿色(#4ade80 现仅用于速率数字的运行态)
  const dotRule = js.match(/\.ds-balance-card__dot\{[^}]*\}/)
  assert.ok(dotRule && !dotRule[0].includes('#4ade80'), '圆点不应使用绿色')
})

test('长按拖动:存在 pointerdown 拖拽逻辑与拖拽状态类', () => {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.includes("addEventListener('pointerdown'"), '应有 pointerdown 监听')
  assert.ok(js.includes('ds-balance-card--dragging'), '应有拖拽状态类')
  assert.ok(js.includes('localStorage.setItem') && js.includes('dsh-balance-card-pos'), '拖动位置应持久化')
})

test('速率行:原底部速率行已移除(速率移入头部左上角)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(!js.includes("makeEl('div', 'ds-balance-card__tps'"), '不应再有底部速率行 div')
  assert.ok(!js.includes('ds-balance-card__tps--idle'), '不应再有旧速率行 idle 类')
  assert.ok(js.includes('tok/s'), 'tok/s 单位保留')
})

// ── 品牌渐变:DeepSeek 标签蓝白渐变动画(时长与 tps 关联) ───────────────

test('品牌渐变:DeepSeek 标签使用蓝白渐变文字动画,时长与 tps 关联', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('ds-balance-card__brand'), '应有品牌类')
  assert.ok(js.includes('@keyframes dsBrandShimmer'), '应有 shimmer 关键帧')
  assert.ok(js.includes('background-clip:text'), '应使用渐变文字')
  assert.ok(js.includes('pulseDuration(data.activity.tps)'), '动画时长应与 tps 关联')
})

test('品牌渐变:仅运行中加动画类,支持 prefers-reduced-motion', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('ds-balance-card__brand--active'), '应有运行动画类')
  assert.ok(js.includes('prefers-reduced-motion'), '应支持无障碍减动')
  assert.ok(js.includes('brand.classList.add'), '动画类应通过 classList 动态添加')
  assert.ok(js.includes('if (data.activity && data.activity.active)'), '仅运行中触发')
})
