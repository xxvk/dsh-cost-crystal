// 用量聚合测试:sessionCost / usage24h(带假 sessionQuery)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { usage24h, sessionActivity, usageByModel } from '../lib/usage.js'
import { sessionCost, sessionCostWithSource } from '../lib/cost.js'
import { predictNext } from '../lib/predict.js'

const UTC = (h, mi = 0) => Date.UTC(2026, 7, 17, h, mi) // 峰谷生效后(2026-08-17),只变 UTC 小时

function usageEv(time, u) {
  return { time, data: { usage: u } }
}

const fakeQuery = (sessions) => ({
  listSessions: async () => sessions.map((header) => ({ header })),
  readSession: async (id) => ({ events: sessions.find((s) => s.id === id)?.events ?? [] }),
})

test('sessionCost: 汇总 token 并按记录时间点归属波峰/低峰', async () => {
  const events = [
    usageEv(UTC(8), { inputTokens: 1000000 }),            // 08:00 UTC → peak,1M miss = 0.44
    usageEv(UTC(8), { cacheReadTokens: 1000000 }),        // 1M hit peak = 0.014
    usageEv(UTC(8), { outputTokens: 1000000 }),           // 1M out peak = 1.32
    usageEv(UTC(5), { inputTokens: 1000000 }),            // 05:00 UTC → offpeak,1M miss = 0.22
    usageEv(UTC(12), { outputTokens: 500000 }),           // 12:00 UTC → offpeak,0.5M out = 0.33
  ]
  const r = await sessionCost(fakeQuery([{ id: 's1', events }]), 's1')
  assert.equal(r.calls, 5)
  assert.equal(r.input, 2000000)
  assert.equal(r.hit, 1000000)
  assert.equal(r.output, 1500000)
  assert.ok(Math.abs(r.peakUsd - (0.44 + 0.014 + 1.32)) < 1e-9)
  assert.ok(Math.abs(r.offUsd - (0.22 + 0.33)) < 1e-9)
  assert.ok(Math.abs(r.usd - (r.peakUsd + r.offUsd)) < 1e-9)
  assert.equal(r.flatUsd, 0, '峰谷生效后不应有平峰')
  assert.ok(r.cny > 0, '应计算官方人民币价')
})

test('sessionCost: 跳过无 usage 或全零的事件', async () => {
  const events = [
    { time: UTC(8), data: { message: {} } },              // 无 usage
    usageEv(UTC(8), { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 }),
    usageEv(UTC(8), { outputTokens: 1000 }),
  ]
  const r = await sessionCost(fakeQuery([{ id: 's1', events }]), 's1')
  assert.equal(r.calls, 1)
  assert.equal(r.output, 1000)
})

test('sessionCost: readSession 抛错返回 null', async () => {
  const bad = { listSessions: async () => [], readSession: async () => { throw new Error('boom') } }
  assert.equal(await sessionCost(bad, 's1'), null)
})

test('usage24h: 只统计 24 小时窗口内的事件', async () => {
  const now = UTC(12)
  const events = [
    usageEv(UTC(12), { outputTokens: 1000 }),              // 窗口内
    usageEv(UTC(11), { outputTokens: 2000 }),              // 窗口内(now-1h)
    usageEv(now - 25 * 3600 * 1000, { outputTokens: 9000 }), // 25 小时前 → 窗口外
  ]
  const r = await usage24h(fakeQuery([{ id: 's1', events }]), now)
  assert.equal(r.calls, 2)
  assert.equal(r.usd > 0, true)
})

test('usage24h: 多会话累计 + listSessions 抛错返回 null', async () => {
  const events = [usageEv(UTC(8), { outputTokens: 1000000 })]
  const r = await usage24h(fakeQuery([{ id: 'a', events }, { id: 'b', events }]), UTC(12))
  assert.equal(r.calls, 2)
  const bad = { listSessions: async () => { throw new Error('boom') }, readSession: async () => ({ events: [] }) }
  assert.equal(await usage24h(bad, UTC(12)), null)
})

// ── 会话活动度:呼吸灯/tps 的数据源 ────────────────────────────────────

test('sessionActivity: 窗口内输出 tokens 计算 tps,近期事件判定 active', async () => {
  const now = Date.now()
  const events = [
    { time: now - 5000, data: { usage: { outputTokens: 6000 } } },  // 5s 前 → active;窗口内
    { time: now - 40000, data: { usage: { outputTokens: 12000 } } }, // 40s 前,窗口内
    { time: now - 90000, data: { usage: { outputTokens: 90000 } } }, // 90s 前,窗口外
  ]
  const r = await sessionActivity(fakeQuery([{ id: 's1', events }]), 's1')
  assert.equal(r.active, true)
  assert.equal(r.tps, 300) // (6000+12000)/60
})

test('sessionActivity: 事件陈旧则 inactive,tps 为 0', async () => {
  const now = Date.now()
  const events = [{ time: now - 120000, data: { usage: { outputTokens: 6000 } } }]
  const r = await sessionActivity(fakeQuery([{ id: 's1', events }]), 's1')
  assert.equal(r.active, false)
  assert.equal(r.tps, 0)
})

test('sessionActivity: readSession 抛错返回 null', async () => {
  const bad = { listSessions: async () => [], readSession: async () => { throw new Error('boom') } }
  assert.equal(await sessionActivity(bad, 's1'), null)
})

// ── 实时解码速率(sessionStats 投影,dsh-token-panel 同款数据源) ─────────

test('predictNext: 上下文取最后一条请求(非历史累计)+ 平均输入/输出', async () => {
  const events = [
    usageEv(UTC(8), { inputTokens: 1000, outputTokens: 500 }),
    usageEv(UTC(8), { inputTokens: 2000, outputTokens: 1500 }),
  ]
  const r = await predictNext(fakeQuery([{ id: 's1', events }]), 's1')
  assert.ok(r, '应返回预测')
  assert.equal(r.contextTokens, 2000) // 最后一条 input(当前上下文,非累计 3000)
  assert.equal(r.avgInput, 1500)
  assert.equal(r.avgOutput, 1000)
  assert.equal(r.predictedInput, 3500) // context(2000)+ avgInput(1500)
  assert.equal(r.predictedOutput, 1000)
  assert.equal(r.totalTokens, 4500)
  assert.ok(r.costCny > 0, '应估算人民币费用')
  assert.ok(r.costUsd > 0, '应估算美元费用')
})

test('predictNext: 多轮请求 cacheRead 重复读取不累计(上下文=最后一条)', async () => {
  const events = [
    usageEv(UTC(8), { inputTokens: 1000, cacheReadTokens: 90000, outputTokens: 300 }),
    usageEv(UTC(8), { inputTokens: 1200, cacheReadTokens: 95000, outputTokens: 400 }),
    usageEv(UTC(8), { inputTokens: 800, cacheReadTokens: 98000, outputTokens: 200 }),
  ]
  const r = await predictNext(fakeQuery([{ id: 's1', events }]), 's1')
  assert.equal(r.contextTokens, 98800, '上下文=最后一条 input+cacheRead,不得累计到 30 万')
  assert.equal(r.predictedInput, 99800) // 98800 + avgInput(1000)
  assert.equal(r.predictedOutput, 300) // avg(300,400,200)
})

test('predictNext: 无历史输出时按上下文 20% 兜底', async () => {
  const events = [usageEv(UTC(8), { inputTokens: 10000 })]
  const r = await predictNext(fakeQuery([{ id: 's1', events }]), 's1')
  assert.equal(r.avgOutput, 2000) // 10000/5
  assert.ok(r.predictedOutput >= 50)
})

test('predictNext: readSession 抛错返回 null', async () => {
  const sq = { listSessions: async () => [], readSession: async () => { throw new Error('x') } }
  assert.equal(await predictNext(sq, 's1'), null)
})

test('predictNext: 优先用 modelHint(当前选中模型)计价', async () => {
  const events = [
    usageEv(UTC(8), { inputTokens: 1000, outputTokens: 500 }),
    usageEv(UTC(8), { inputTokens: 2000, outputTokens: 1500 }),
  ]
  const r = await predictNext(fakeQuery([{ id: 's1', events }]), 's1', 'deepseek-v4-pro')
  assert.ok(r, '应返回预测')
  assert.equal(r.model, 'deepseek-v4-pro', '应优先用传入的当前选中模型')
  assert.ok(r.costCny > 0)
})

test('predictNext: 无 modelHint 时 fallback 历史最后一条 model', async () => {
  const events = [
    { time: UTC(8), data: { usage: { outputTokens: 100 }, source: { model: 'deepseek-v4-flash' } } },
  ]
  const r = await predictNext(fakeQuery([{ id: 's1', events }]), 's1')
  assert.equal(r.model, 'deepseek-v4-flash', '无 hint 时应回退历史模型')
})

test('usageByModel: 按 model 分桶累计 token/费用(deepseek vs VL)', async () => {
  const events = [
    { time: UTC(8), data: { usage: { inputTokens: 1000, outputTokens: 500 }, source: { model: 'deepseek-v4-flash' } } },
    { time: UTC(8), data: { usage: { inputTokens: 200, outputTokens: 300 }, source: { model: 'deepseek-v4-flash' } } },
    { time: UTC(8), data: { usage: { inputTokens: 50, outputTokens: 80 }, source: { model: 'aliyun/qwen3-vl-flash' } } },
  ]
  const r = await usageByModel(fakeQuery([{ id: 's1', events }]), 's1')
  assert.ok(r, '应返回分桶')
  assert.equal(r.length, 2, '两个模型各一桶')
  const deep = r.find((b) => b.model === 'deepseek-v4-flash')
  const vl = r.find((b) => b.model === 'aliyun/qwen3-vl-flash')
  assert.ok(deep && vl, '两桶都应存在')
  assert.equal(deep.calls, 2)
  assert.equal(deep.input, 1200)
  assert.equal(deep.output, 800)
  assert.equal(vl.calls, 1)
  assert.equal(vl.input, 50)
  assert.equal(vl.output, 80)
  assert.ok(deep.costCny > 0 && vl.costCny > 0, '两桶都应有费用')
  assert.ok(r[0].costCny >= r[1].costCny, '按费用降序')
})

test('usageByModel: readSession 抛错返回 null', async () => {
  const sq = { listSessions: async () => [], readSession: async () => { throw new Error('x') } }
  assert.equal(await usageByModel(sq, 's1'), null)
})
