// 行数规则测试:src/test 源码 >300 行报错(硬上限),≥200 警告(理想值),lib/ 生成物豁免
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const CHECK = join(process.cwd(), 'scripts/check-lines.mjs')

function runCheck(dir) {
  const r = spawnSync(process.execPath, [CHECK, dir], { encoding: 'utf8' })
  return { code: r.status ?? 1, out: String(r.stdout ?? '') + String(r.stderr ?? '') }
}

function makeFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dscc-lines-'))
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content)
  }
  return dir
}

/** N 行文件内容(行数 = 换行符数量,wc -l 语义) */
const lines = (n) => '// x\n'.repeat(n)

test('行数规则:超过 300 行报错(退出码 1)并点名文件', () => {
  const dir = makeFixture({ 'too-big.ts': lines(301) })
  try {
    const r = runCheck(dir)
    assert.equal(r.code, 1, `应失败,输出: ${r.out}`)
    assert.ok(r.out.includes('too-big.ts'), '应点名超限文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('行数规则:恰好 300 行通过', () => {
  const dir = makeFixture({ 'at-cap.ts': lines(300) })
  try {
    const r = runCheck(dir)
    assert.equal(r.code, 0, `应通过,输出: ${r.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('行数规则:200–300 行警告但通过', () => {
  const dir = makeFixture({ 'warn.ts': lines(250) })
  try {
    const r = runCheck(dir)
    assert.equal(r.code, 0)
    assert.ok(r.out.includes('⚠') || r.out.includes('建议'), '应给出推荐值警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('行数规则:200 行以内无警告', () => {
  const dir = makeFixture({ 'ok.ts': lines(150) })
  try {
    const r = runCheck(dir)
    assert.equal(r.code, 0)
    assert.ok(!r.out.includes('⚠'), '不应有警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('行数规则:lib/ 生成物豁免(即使超长也不报错)', () => {
  const dir = makeFixture({ 'lib/generated.js': lines(500) })
  try {
    const r = runCheck(dir)
    assert.equal(r.code, 0, `lib/ 应被忽略,输出: ${r.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('行数规则:node_modules 豁免', () => {
  const dir = makeFixture({ 'node_modules/big.js': lines(999) })
  try {
    const r = runCheck(dir)
    assert.equal(r.code, 0, 'node_modules 应被忽略')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('行数规则:src/card-script.ts 生成物豁免(即使超长也不报错)', () => {
  const dir = makeFixture({ 'src/card-script.ts': lines(500), 'src/cost-script.ts': lines(450) })
  try {
    const r = runCheck(dir)
    assert.equal(r.code, 0, `生成脚本应被豁免,输出: ${r.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
