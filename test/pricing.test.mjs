// 定价引擎测试:时段判定、边界、费率数学
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RATES, PEAK_UTC, USD_CNY, modeAt, nextBoundary, costUsd, activePolicy, OFFICIAL_PRICING_POLICIES, priceAt, costOf } from '../lib/pricing.js'

const UTC = (y, mo, d, h, mi = 0) => Date.UTC(y, mo, d, h, mi)

test('PEAK_UTC 窗口定义正确', () => {
  assert.deepEqual(PEAK_UTC, [[1, 4], [6, 10]])
})

test('modeAt: 波峰窗口内为 peak,窗口外为 offpeak', () => {
  // 窗口 [1,4) 与 [6,10) UTC
  assert.equal(modeAt(UTC(2026, 7, 15, 1, 0)), 'peak')   // 01:00 入峰
  assert.equal(modeAt(UTC(2026, 7, 15, 3, 59)), 'peak') // 03:59 仍在峰
  assert.equal(modeAt(UTC(2026, 7, 15, 4, 0)), 'offpeak') // 04:00 出峰
  assert.equal(modeAt(UTC(2026, 7, 15, 5, 59)), 'offpeak')
  assert.equal(modeAt(UTC(2026, 7, 15, 6, 0)), 'peak')   // 06:00 二次入峰
  assert.equal(modeAt(UTC(2026, 7, 15, 9, 59)), 'peak')
  assert.equal(modeAt(UTC(2026, 7, 15, 10, 0)), 'offpeak')
  assert.equal(modeAt(UTC(2026, 7, 15, 23, 59)), 'offpeak')
  assert.equal(modeAt(UTC(2026, 7, 15, 0, 0)), 'offpeak')
})

test('nextBoundary: 返回下一个 UTC 整点边界 01/04/06/10', () => {
  assert.equal(nextBoundary(UTC(2026, 7, 15, 3, 30)), UTC(2026, 7, 15, 4, 0))
  assert.equal(nextBoundary(UTC(2026, 7, 15, 4, 0)), UTC(2026, 7, 15, 6, 0))
  assert.equal(nextBoundary(UTC(2026, 7, 15, 10, 0)), UTC(2026, 7, 16, 1, 0))
  assert.equal(nextBoundary(UTC(2026, 7, 15, 11, 0)), UTC(2026, 7, 16, 1, 0))
  assert.equal(nextBoundary(UTC(2026, 7, 15, 0, 30)), UTC(2026, 7, 15, 1, 0))
})

test('RATES: 低峰恰为波峰半价', () => {
  for (const k of ['cacheHit', 'cacheMiss', 'output']) {
    assert.equal(RATES.offpeak[k], RATES.peak[k] / 2, `${k} 半价`)
  }
})

test('costUsd: 每百万 tokens 单价换算正确', () => {
  assert.ok(Math.abs(costUsd({ inputTokens: 1e6 }, 'offpeak') - RATES.offpeak.cacheMiss) < 1e-9)
  assert.ok(Math.abs(costUsd({ cacheReadTokens: 1e6 }, 'offpeak') - RATES.offpeak.cacheHit) < 1e-9)
  assert.ok(Math.abs(costUsd({ outputTokens: 1e6 }, 'peak') - RATES.peak.output) < 1e-9)
})

test('costUsd: 空/缺字段按 0 处理', () => {
  assert.equal(costUsd({}, 'peak'), 0)
  assert.equal(costUsd({ inputTokens: undefined, cacheReadTokens: undefined, outputTokens: undefined }, 'peak'), 0)
})

test('USD_CNY 展示汇率存在且为正', () => {
  assert.ok(USD_CNY > 0)
})

// ── 官方政策定价引擎(移植自 dsh-web-billing / dsh-deepseek-quota) ─────

const PRE = Date.UTC(2026, 7, 15, 8)   // 2026-08-15,峰谷政策生效前 → flat
const POST_PEAK = Date.UTC(2026, 7, 17, 8)   // 峰谷后 08:00 UTC → peak
const POST_OFF = Date.UTC(2026, 7, 17, 5)    // 峰谷后 05:00 UTC → offPeak

test('activePolicy: 按时间返回生效政策(峰谷前后切换)', () => {
  assert.equal(activePolicy(PRE), OFFICIAL_PRICING_POLICIES[1]) // 2026-05-22 V4 平峰价
  assert.equal(activePolicy(POST_PEAK), OFFICIAL_PRICING_POLICIES[2]) // 2026-08-17 峰谷价
})

test('priceAt: 峰谷生效前的消息用平峰价(mode=flat)', () => {
  const u = priceAt('deepseek-v4-flash', PRE)
  assert.equal(u.mode, 'flat')
  assert.deepEqual(u.usd, { input: 0.14, cacheRead: 0.0028, output: 0.28 })
})

test('priceAt: 峰谷生效后按时刻判定 peak/offPeak', () => {
  const p = priceAt('deepseek-v4-flash', POST_PEAK)
  assert.equal(p.mode, 'peak')
  assert.deepEqual(p.usd, { input: 0.44, cacheRead: 0.014, output: 1.32 })
  const o = priceAt('deepseek-v4-flash', POST_OFF)
  assert.equal(o.mode, 'offPeak')
  assert.deepEqual(o.usd, { input: 0.22, cacheRead: 0.007, output: 0.66 })
})

test('priceAt: 模型感知(v4-pro 用 pro 价,未知模型用 * 兜底)', () => {
  const pro = priceAt('deepseek-v4-pro', POST_PEAK)
  assert.equal(pro.usd.input, 1.32)
  const star = priceAt('unknown-model', POST_PEAK)
  assert.equal(star.usd.input, 0.44)
})

test('costOf: 双币种费用计算', () => {
  const unit = priceAt('deepseek-v4-flash', POST_PEAK)
  const r = costOf({ inputTokens: 1e6, cacheReadTokens: 1e6, outputTokens: 1e6 }, unit)
  assert.ok(Math.abs(r.costUsd - (0.44 + 0.014 + 1.32)) < 1e-9)
  assert.ok(Math.abs(r.cost - (3 + 0.1 + 9)) < 1e-9) // 官方人民币价
})
