// 模型相关测试:model 名映射、per-model 统计、模型切换(v0.2)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARD_SCRIPT } from '../lib/scripts.js'

function jsOf(raw) {
  const js = raw.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.length > 100, '脚本不应为空')
  return js
}
function modelKeyFromLabelOf(js) {
  const m = js.match(/function modelKeyFromLabel\(label\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 modelKeyFromLabel 函数')
  return new Function(`return (${m[0]})`)()
}

test('modelKeyFromLabel: DOM 显示名 → 定价模型 key', () => {
  const f = modelKeyFromLabelOf(jsOf(CARD_SCRIPT))
  assert.equal(f('DeepSeek-V4-FlashHigh'), 'deepseek-v4-flash')
  assert.equal(f('DeepSeek-V4-Pro'), 'deepseek-v4-pro')
  assert.equal(f('deepseek-reasoner'), 'deepseek-reasoner')
  assert.equal(f('DeepSeek Chat'), 'deepseek-chat')
  assert.equal(f('garbage'), null)
})

function shortModelOf(js) {
  const m = js.match(/function shortModel\(m\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 shortModel 函数')
  return new Function(`return (${m[0]})`)()
}

test('shortModel: 模型名短化(deepseek/qwen3-vl 等)', () => {
  const f = shortModelOf(jsOf(CARD_SCRIPT))
  assert.equal(f('deepseek-v4-flash'), 'deepseek')
  assert.equal(f('deepseek-v4-pro'), 'pro')
  assert.equal(f('aliyun/qwen3-vl-flash'), 'qwen3-vl')
  assert.equal(f('some/gateway-model'), 'gateway-model')
})

test('per-model 统计:多模型时渲染摘要行(data.byModel)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('data.byModel'), '渲染应消费 byModel 字段')
  assert.ok(js.includes('ds-balance-card__models'), '应有 per-model 行类')
  assert.ok(js.includes('shortModel'), '应使用 shortModel 短化模型名')
})

function modelSwitchNextOf(js) {
  const m = js.match(/function modelSwitchNext\(current, groups\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 modelSwitchNext 函数')
  return new Function(`return (${m[0]})`)()
}

test('modelSwitchNext: 展平 groups 循环切换(deepseek→VL→回到第一个)', () => {
  const f = modelSwitchNextOf(jsOf(CARD_SCRIPT))
  const groups = [
    { id: 'deepseek-official', models: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }] },
    { id: 'vision-http', models: [{ id: 'aliyun/qwen3-vl-flash' }] },
  ]
  const next1 = f({ provider: 'deepseek-official', model: 'deepseek-v4-flash' }, groups)
  assert.deepEqual(next1, { provider: 'deepseek-official', model: 'deepseek-v4-pro' })
  const next2 = f({ provider: 'deepseek-official', model: 'deepseek-v4-pro' }, groups)
  assert.deepEqual(next2, { provider: 'vision-http', model: 'aliyun/qwen3-vl-flash' })
  const next3 = f({ provider: 'vision-http', model: 'aliyun/qwen3-vl-flash' }, groups)
  assert.deepEqual(next3, { provider: 'deepseek-official', model: 'deepseek-v4-flash' }, '循环回到第一个')
  assert.equal(f({ provider: 'x', model: 'y' }, []), null, '空目录返回 null')
})

test('模型切换:脚本含 session.models/selectModel RPC 与切换按钮', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes("'session.models'"), '应调用 session.models 拉可用模型')
  assert.ok(js.includes("'session.selectModel'"), '应调用 session.selectModel 提交切换')
  assert.ok(js.includes('ds-balance-card__switch'), '应有切换按钮类')
  assert.ok(js.includes('modelSwitch'), '应有切换函数')
})
