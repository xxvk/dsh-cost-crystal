// 注入脚本回归测试:两段脚本必须作为合法 JS 可解析,且不因转义问题被截断。
// 历史 bug 1:注入经 String.replace 时 $&/$'/$$ 被展开(已改用切片注入,见 index.test)
// 历史 bug 2:模板字符串内 \n 被求值为真实换行,截断单引号字符串 → 整段脚本语法错误。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARD_SCRIPT, COST_SCRIPT } from '../lib/scripts.js'

/** 剥离 <script> 包装后的纯 JS 部分 */
function jsOf(raw) {
  const js = raw.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.length > 100, '脚本不应为空')
  return js
}

test('卡片脚本可被解析为合法 JS(new Function 编译)', () => {
  // 若字符串被真实换行截断,这里会抛 SyntaxError
  assert.doesNotThrow(() => new Function(jsOf(CARD_SCRIPT)))
})

test('费用脚本可被解析为合法 JS(new Function 编译)', () => {
  assert.doesNotThrow(() => new Function(jsOf(COST_SCRIPT)))
})

test('回归:工具提示里的换行必须是反斜杠-n 转义,而非真实换行', () => {
  const js = jsOf(CARD_SCRIPT)
  // '次\n更新时间' —— 期望字符串内是 2 字符的 \n 序列
  assert.ok(js.includes('次\\n更新时间'), '应保留反斜杠-n 转义')
  // 「次」与「更新时间」之间不得出现真实换行(真实换行会把单引号字符串截断)
  const i = js.indexOf('更新时间')
  const seg = js.slice(Math.max(0, i - 12), i + 8)
  assert.ok(!seg.includes('\n'), `更新前不应有真实换行: ${JSON.stringify(seg)}`)
})

test('脚本结构关键点存在(卡片: 波峰/低峰、近24h、top:60px)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('波峰'))
  assert.ok(js.includes('低峰'))
  assert.ok(js.includes('近24h'))
  assert.ok(js.includes('top:60px'))
})

test('脚本结构关键点存在(费用: 会话费用文案)', () => {
  const js = jsOf(COST_SCRIPT)
  assert.ok(js.includes('费用 ≈'))
  assert.ok(js.includes('/ds-session-cost'))
})

test('脚本不含外层模板字面量的反引号/插值残留', () => {
  assert.ok(!CARD_SCRIPT.includes('`'))
  assert.ok(!CARD_SCRIPT.includes('${'))
  assert.ok(!COST_SCRIPT.includes('`'))
  assert.ok(!COST_SCRIPT.includes('${'))
})

// ── 币种显示优先级:只显示有余额的;都有余额时 USD 优先 ─────────────

/** 从卡片脚本中提取 pickCurrencies 函数源码并求值为可调用函数 */
function extractPickCurrencies() {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  const m = js.match(/function pickCurrencies\(infos\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 pickCurrencies 函数')
  return new Function(`return (${m[0]})`)()
}

test('pickCurrencies: 只有 USD 有余额时只显示 USD', () => {
  const pick = extractPickCurrencies()
  const infos = [
    { currency: 'CNY', total: '0.00' },
    { currency: 'USD', total: '12.34' },
  ]
  assert.deepEqual(pick(infos).map((b) => b.currency), ['USD'])
})

test('pickCurrencies: 只有 CNY 有余额时只显示 CNY', () => {
  const pick = extractPickCurrencies()
  const infos = [
    { currency: 'CNY', total: '100.00' },
    { currency: 'USD', total: '0.00' },
  ]
  assert.deepEqual(pick(infos).map((b) => b.currency), ['CNY'])
})

test('pickCurrencies: 两者都有余额时 USD 优先', () => {
  const pick = extractPickCurrencies()
  const infos = [
    { currency: 'CNY', total: '100.00' },
    { currency: 'USD', total: '5.00' },
  ]
  assert.deepEqual(pick(infos).map((b) => b.currency), ['USD', 'CNY'])
})

test('pickCurrencies: 都无余额时保留全部(显示 0)', () => {
  const pick = extractPickCurrencies()
  const infos = [
    { currency: 'CNY', total: '0.00' },
    { currency: 'USD', total: '0.00' },
  ]
  assert.deepEqual(pick(infos).map((b) => b.currency), ['CNY', 'USD'])
})

test('pickCurrencies: 空列表返回空', () => {
  const pick = extractPickCurrencies()
  assert.deepEqual(pick([]), [])
  assert.deepEqual(pick(undefined), [])
})

// ── 近24h 消耗:单货币 + 与余额同一行(字体区分) ───────────────────────

/** 从卡片脚本中提取 usageText 函数 */
function extractUsageText() {
  const js = CARD_SCRIPT.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  const m = js.match(/function usageText\(usd, currency\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 usageText 函数')
  return new Function(`return (${m[0]})`)()
}

test('usageText: USD 货币直接显示美元', () => {
  const f = extractUsageText()
  assert.equal(f(1.28, 'USD'), '$1.28')
  assert.equal(f(0, 'USD'), '$0.00')
})

test('usageText: CNY 货币按汇率换算显示人民币(仅一种货币)', () => {
  const f = extractUsageText()
  assert.equal(f(1.28, 'CNY'), '¥9.09') // 1.28 × 7.1 = 9.088 → 9.09
  assert.equal(f(0, 'CNY'), '¥0.00')
})

test('usageText: 未知货币按人民币处理', () => {
  const f = extractUsageText()
  assert.equal(f(1, 'EUR'), '¥7.10')
})

