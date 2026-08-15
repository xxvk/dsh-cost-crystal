// build-scripts 测试:生成的 TS 模板字符串求值后必须与纯 JS 内联文件完全一致。
// 这是"编辑注入脚本→纯 JS 文件→生成器转义"管线的回归保障,杜绝转义地狱。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BUILD = join(process.cwd(), 'scripts/build-scripts.mjs')
const root = process.cwd()

function runBuild() {
  execFileSync(process.execPath, [BUILD], { encoding: 'utf8' })
}

/** 从生成的 .ts 提取模板内容并求值,返回原始脚本(含 <script> 包装) */
function evaluateGenerated(name) {
  const src = readFileSync(join(root, `src/${name === 'CARD_SCRIPT' ? 'card' : 'cost'}-script.ts`), 'utf8')
  const m = src.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`\n`))
  assert.ok(m, `${name} 模板应存在`)
  const tmp = mkdtempSync(join(tmpdir(), 'dscc-esc-'))
  try {
    writeFileSync(join(tmp, 'm.cjs'), 'module.exports = `' + m[1] + '`\n')
    const mod = require(join(tmp, 'm.cjs'))
    return mod
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

const strip = (s) => s.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')

test('build-scripts: 生成的 CARD_SCRIPT 求值后与三个片段拼接一致', () => {
  runBuild()
  const generated = strip(evaluateGenerated('CARD_SCRIPT'))
  let expected = readFileSync(join(root, 'src/scripts/card.inline.js'), 'utf8')
  for (const [slot, file] of [['// CARD_FMT_SLOT', 'card-fmt.inline.js'], ['// CARD_RENDER_SLOT', 'card-render.inline.js']]) {
    const frag = readFileSync(join(root, 'src/scripts/' + file), 'utf8')
    const idx = expected.indexOf(slot)
    assert.ok(idx !== -1, `card.inline.js 应有 ${slot} 占位`)
    expected = expected.slice(0, idx) + frag.trimEnd() + '\n' + expected.slice(idx + slot.length)
  }
  assert.equal(generated.trim(), expected.trim(), '生成结果必须与拼接后的源一致(忽略包装换行)')
})

test('build-scripts: 生成的 COST_SCRIPT 求值后与 cost.inline.js 完全一致', () => {
  runBuild()
  const generated = strip(evaluateGenerated('COST_SCRIPT'))
  const inline = readFileSync(join(root, 'src/scripts/cost.inline.js'), 'utf8')
  assert.equal(generated.trim(), inline.trim(), '生成结果必须与纯 JS 源一致(忽略包装换行)')
})

test('build-scripts: 幂等(重复运行结果不变)', () => {
  runBuild()
  const a = readFileSync(join(root, 'src/card-script.ts'), 'utf8')
  runBuild()
  const b = readFileSync(join(root, 'src/card-script.ts'), 'utf8')
  assert.equal(a, b, '重复生成应得到相同输出')
})
