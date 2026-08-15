// 数据时效(agoText)测试:从卡片脚本提取纯函数断言行为 + 渲染结构回归。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARD_SCRIPT } from '../lib/scripts.js'

function jsOf(raw) {
  const js = raw.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.length > 100, '脚本不应为空')
  return js
}

function agoTextOf(js) {
  const m = js.match(/function agoText\(ts, now\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 agoText 函数')
  return new Function(`return (${m[0]})`)()
}

test('agoText: 数据时效文本(刚刚/Ns前/Nm前/Nh前/Nd前)', () => {
  const ago = agoTextOf(jsOf(CARD_SCRIPT))
  const now = 1_000_000_000_000
  assert.equal(ago(now, now), '刚刚')
  assert.equal(ago(now - 5_000, now), '刚刚')
  assert.equal(ago(now - 20_000, now), '20s前')
  assert.equal(ago(now - 59_000, now), '59s前')
  assert.equal(ago(now - 60_000, now), '1m前')
  assert.equal(ago(now - 120_000, now), '2m前')
  assert.equal(ago(now - 3_600_000, now), '1h前')
  assert.equal(ago(now - 86_400_000, now), '1d前')
  assert.equal(ago(now + 5_000, now), '刚刚')
})

test('布局:余额上方时间改为数据时效(agoText 渲染,非时钟)', () => {
  const js = jsOf(CARD_SCRIPT)
  const re = /makeEl\('span', 'ds-balance-card__time', ([^)]*)\)/g
  const calls = [...js.matchAll(re)]
  assert.ok(calls.length >= 2, '骨架屏与正式渲染都应创建 time span')
  assert.ok(calls.at(-1)[1].includes('agoText'), '正式渲染的 time 应为 agoText 文本')
})
