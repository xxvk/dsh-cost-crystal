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

function originClassOf(js) {
  const m = js.match(/function originClass\(sel\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 originClass 函数')
  return m[0]
}
function modelOptionsOf(js) {
  const m = js.match(/function modelOptions\([^)]*\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 modelOptions 函数')
  return new Function(originClassOf(js) + '; return (' + m[0] + ')')()
}

test('modelOptions: groups → 只保留 deepseek 官方/qwen 两类,每类一项', () => {
  const f = modelOptionsOf(jsOf(CARD_SCRIPT))
  const groups = [
    { id: 'deepseek-official', models: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }] },
    { id: 'vision-http', models: [{ id: 'aliyun/qwen3-vl-flash' }] },
    { id: 'nous-portal', models: [{ id: 'nous/hermes' }] },
  ]
  assert.deepEqual(f(groups), [
    { provider: 'deepseek-official', model: 'deepseek-v4-flash', cls: 'deepseek' },
    { provider: 'vision-http', model: 'aliyun/qwen3-vl-flash', cls: 'qwen' },
  ])
  // 其它来源(polyglot 等)被过滤
  assert.deepEqual(f([{ id: 'p', models: [{ id: 'm' }, { id: 'm' }] }]), [], '非 deepseek/qwen 来源应被过滤')
  assert.deepEqual(f([]), [], '空目录返回空数组')
  assert.deepEqual(f(undefined), [], '未定义目录返回空数组')
})

test('modelOptions: current 命中某类时保留当前模型(不降级)', () => {
  const f = modelOptionsOf(jsOf(CARD_SCRIPT))
  const groups = [
    { id: 'deepseek-official', models: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }] },
    { id: 'vision-http', models: [{ id: 'aliyun/qwen3-vl-flash' }] },
  ]
  assert.deepEqual(f(groups, { provider: 'deepseek-official', model: 'deepseek-v4-pro' }), [
    { provider: 'deepseek-official', model: 'deepseek-v4-pro', cls: 'deepseek' },
    { provider: 'vision-http', model: 'aliyun/qwen3-vl-flash', cls: 'qwen' },
  ])
  // current 是 qwen 时,qwen 选项用 current 模型
  assert.deepEqual(f(groups, { provider: 'vision-http', model: 'aliyun/qwen3-vl-flash' }), [
    { provider: 'deepseek-official', model: 'deepseek-v4-flash', cls: 'deepseek' },
    { provider: 'vision-http', model: 'aliyun/qwen3-vl-flash', cls: 'qwen' },
  ])
})

test('originClass: 来源归类(deepseek 官方/qwen/其它)', () => {
  const oc = new Function(`return (${originClassOf(jsOf(CARD_SCRIPT))})`)()
  assert.equal(oc({ provider: 'deepseek-official', model: 'deepseek-v4-flash' }), 'deepseek')
  assert.equal(oc({ provider: 'deepseek-official', model: 'deepseek-v4-pro' }), 'deepseek')
  assert.equal(oc({ provider: 'vision-http', model: 'aliyun/qwen3-vl-flash' }), 'qwen')
  assert.equal(oc({ provider: 'x', model: 'foo/bar' }), 'bar')
})

test('originLabel: 来源显示名(DeepSeek 官方 / Qwen 阿里云)', () => {
  const js = jsOf(CARD_SCRIPT)
  const m = js.match(/function originLabel\(cls\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 originLabel 函数')
  const ol = new Function(`return (${m[0]})`)()
  assert.equal(ol('deepseek'), 'DeepSeek 官方')
  assert.equal(ol('qwen'), 'Qwen 阿里云')
  assert.equal(ol('other'), 'other')
})

test('模型选择:脚本含下拉菜单与用户驱动的 session.models/selectModel RPC', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes("'session.models'"), '应调用 session.models 拉可用模型')
  assert.ok(js.includes("'session.selectModel'"), '应调用 session.selectModel 提交切换')
  assert.ok(js.includes('ds-balance-card__switch'), '应有切换按钮(▼)类')
  assert.ok(js.includes('ds-balance-card__menu'), '应有下拉菜单类')
  assert.ok(js.includes('ds-balance-card__menuitem'), '应有菜单选项类')
  assert.ok(js.includes('openModelMenu'), '应有点击▼打开菜单的函数')
  assert.ok(js.includes('selectModel('), '应有用户选择后提交的函数')
  assert.ok(!js.includes('modelSwitchNext'), '不应再有自动循环切换 modelSwitchNext')
})
