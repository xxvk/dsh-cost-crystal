// 文档持久性测试:确保 agent 开发守则(AGENTS.md)存在且关键陷阱提示不丢失。
// 这些坑历史上被踩过两次($ 展开、\n 转义),必须持续固化在 agent 可识别的文件里。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function agentsMd() {
  return readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')
}

test('AGENTS.md 存在且可读', () => {
  assert.doesNotThrow(() => agentsMd())
})

test('AGENTS.md 固化陷阱1:禁用 String.replace 注入(含 $ 展开警告)', () => {
  const s = agentsMd()
  assert.ok(s.includes('String.replace'), '应提到 String.replace')
  assert.ok(s.includes("$'"), '应提到 $ 展开($\')')
  assert.ok(s.includes('切片') || s.includes('injectScript'), '应给出切片拼接方案')
})

test('AGENTS.md 固化陷阱2:注入脚本只编辑 inline.js,警告手写转义', () => {
  const s = agentsMd()
  assert.ok(s.includes('inline.js'), '应提到纯 JS 内联源')
  assert.ok(s.includes('\\\\n'), '应提到反斜杠转义层叠')
  assert.ok(s.includes('转义地狱'), '应警告转义地狱')
  assert.ok(s.includes('build-scripts.mjs'), '应提到生成器')
})

test('AGENTS.md 固化完成门槛:引用了 npm test', () => {
  const s = agentsMd()
  assert.ok(s.includes('npm test'), '应提到完成门槛命令')
})

test('AGENTS.md 固化测试约定:脚本纯函数提取测试法', () => {
  const s = agentsMd()
  assert.ok(s.includes('pickCurrencies') || s.includes('提取纯函数'), '应提到脚本函数提取测试法')
})
