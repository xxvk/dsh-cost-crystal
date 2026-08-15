// 卡片预测区(forecast)测试:水晶球占位、左对齐、下一条预测渲染。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARD_SCRIPT } from '../lib/scripts.js'

function jsOf(raw) {
  const js = raw.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.length > 100, '脚本不应为空')
  return js
}

test('预测占位:divider 下方为 🔮 水晶球(forecast 行)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('.ds-balance-card__forecast'), '应有 forecast 样式')
  assert.ok(js.includes('🔮'), '应含水晶球 emoji 占位')
})

test('预测占位:🔮 左对齐(forecast 非居中)', () => {
  const js = jsOf(CARD_SCRIPT)
  const t = js.match(/\.ds-balance-card__forecast\{[^}]*\}/)
  assert.ok(t, '应有 forecast 样式')
  assert.doesNotMatch(t[0], /text-align:\s*center/, '水晶球应左对齐(当前居中)')
})

test('预测展示:forecast 行渲染下一条预测(🔮 + 此次预测 + M 单位)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('data.prediction'), '渲染应消费 prediction 字段')
  assert.ok(js.includes('此次预测'), '应有「此次预测」文案')
  assert.ok(js.includes("' tok "), '单位固定为 tok(M 由 fmtM 测试保证)')
  assert.ok(js.includes('fmtM'), '应有 M 单位格式化函数')
})

function fmtMOf(js) {
  const m = js.match(/function fmtM\(n\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 fmtM 函数')
  return new Function(`return (${m[0]})`)()
}

test('fmtM: ≥1M 整数、<1M 一位小数、最小 0.1M', () => {
  const fmt = fmtMOf(jsOf(CARD_SCRIPT))
  assert.equal(fmt(305340000), '305M')
  assert.equal(fmt(1030000), '1M')
  assert.equal(fmt(1600000), '2M')
  assert.equal(fmt(536000), '0.5M')
  assert.equal(fmt(50000), '0.1M')
})

function fmtCostOf(js) {
  const m = js.match(/function fmtCost\(cny\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 fmtCost 函数')
  return new Function(`return (${m[0]})`)()
}

test('fmtCost: 小额费用保留有效位数(不显示 0.00)', () => {
  const fmt = fmtCostOf(jsOf(CARD_SCRIPT))
  assert.equal(fmt(12.345), '¥12.35')
  assert.equal(fmt(0.42), '¥0.420')
  assert.equal(fmt(0.0042), '¥0.0042')
  assert.equal(fmt(0), '¥0')
})

function fmtTpsOf(js) {
  const m = js.match(/function fmtTps\(n\) \{[\s\S]*?\}/)
  assert.ok(m, '卡片脚本应包含 fmtTps 函数')
  return new Function(`return (${m[0]})`)()
}

test('fmtTps: 速率 tok 只取整数(不需要小数)', () => {
  const fmt = fmtTpsOf(jsOf(CARD_SCRIPT))
  assert.equal(fmt(134), '134')
  assert.equal(fmt(9.6), '10')
  assert.equal(fmt(0.5), '1')
  assert.equal(fmt(0), '0')
})

test('卡片尺寸规则:宽度固定 256px,高度 ≤240px 动态', () => {
  const js = jsOf(CARD_SCRIPT)
  const card = js.match(/\.ds-balance-card\{[^}]*\}/)
  assert.ok(card, '应有卡片样式')
  assert.match(card[0], /width:\s*256px/, '宽度固定 256px')
  assert.doesNotMatch(card[0], /min-width|max-width/, '不再用 min/max 宽度')
  assert.match(card[0], /max-height:\s*240px/, '高度上限 240px')
  assert.match(card[0], /overflow:\s*hidden/, '超出高度裁剪')
})

test('布局:近24h 消耗靠右对齐(usage margin-left:auto)', () => {
  const js = jsOf(CARD_SCRIPT)
  const t = js.match(/\.ds-balance-card__usage\{[^}]*\}/)
  assert.ok(t, '应有 usage 样式')
  assert.match(t[0], /margin-left:\s*auto/, '近24h 应靠右对齐')
})

test('布局:波峰/低峰与倒计时相对居中(period justify-content:center)', () => {
  const js = jsOf(CARD_SCRIPT)
  const t = js.match(/\.ds-balance-card__period\{[^}]*\}/)
  assert.ok(t, '应有 period 样式')
  assert.match(t[0], /justify-content:\s*center/, 'period 行应居中')
})

function fmtNextAtOf(js) {
  const m = js.match(/function fmtNextAt\(ts, now\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 fmtNextAt 函数')
  return new Function(`return (${m[0]})`)()
}

test('fmtNextAt: 日期细化(今日/明日/日期)+ 12 小时制 AM/PM', () => {
  const fmt = fmtNextAtOf(jsOf(CARD_SCRIPT))
  const now = new Date(2026, 7, 17, 12, 0)
  assert.equal(fmt(new Date(2026, 7, 17, 10, 0), now), '(今日10:00AM)')
  assert.equal(fmt(new Date(2026, 7, 18, 22, 30), now), '(明日10:30PM)')
  assert.equal(fmt(new Date(2026, 7, 20, 15, 5), now), '(8月20日3:05PM)')
  assert.equal(fmt(new Date(2026, 7, 17, 0, 5), now), '(今日12:05AM)')
})

test('布局:倒计时渲染使用 fmtNextAt(替换纯时间)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('fmtNextAt(data.period.nextAt)'), '倒计时应使用 fmtNextAt')
})

test('fmtNextAt: 单参数调用(now 缺省为当前时刻)→ 今天 12:00 显示今日', () => {
  const fmt = fmtNextAtOf(jsOf(CARD_SCRIPT))
  const today = new Date()
  const ts = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0).getTime()
  const out = fmt(ts) // 不传 now → 应默认当前时刻,与 ts 同一天
  assert.ok(out.startsWith('(今日'), `今天 12:00 应显示今日,实际: ${out}`)
})

test('预测价格:黑白强调(独立 cost span)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('ds-balance-card__cost'), '应有价格强调 span 类')
  const t = js.match(/\.ds-balance-card__cost\{[^}]*\}/)
  assert.ok(t, '应有 cost 样式')
  assert.match(t[0], /color:\s*#fff/, '深色模式应纯白')
})

test('主题:卡片跟随 DSH 客户端暗黑/亮色(body data-ds-dark-theme)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('body:not([data-ds-dark-theme])'), '亮色模式应通过 body 无 data-ds-dark-theme 选择')
})

