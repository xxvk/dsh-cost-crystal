// build-profile 测试:生成的独立 profile 插件文件必须可加载且与构建产物一致。
// 该脚本是"改完源码 → 重新生成 profile 插件"的唯一入口,防止 host 代码漂移。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const BUILD = join(process.cwd(), 'scripts/build-profile.mjs')

function runBuild(outDir) {
  execFileSync(process.execPath, [BUILD, outDir], { encoding: 'utf8' })
}

test('build-profile: 生成且仅生成一个独立插件文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dscc-profile-'))
  try {
    runBuild(dir)
    const files = readdirSync(dir).filter((f) => /^ds-balance-v\d+\.js$/.test(f))
    assert.equal(files.length, 1, `应生成一个文件: ${files.join(',')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('build-profile: 生成文件可加载且与 lib 插件一致', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dscc-profile-'))
  try {
    runBuild(dir)
    const name = readdirSync(dir).find((f) => /^ds-balance-v\d+\.js$/.test(f))
    const generated = require(join(dir, name))
    const lib = require('../lib/index.js')
    const g = generated.default ?? generated
    const l = lib.default ?? lib
    assert.deepEqual(g.inject, l.inject, 'inject 应一致')
    assert.equal(typeof g.apply, 'function', 'apply 应为函数')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('build-profile: 重复运行只保留最新一个文件(旧文件被清理)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dscc-profile-'))
  try {
    runBuild(dir)
    runBuild(dir)
    const files = readdirSync(dir).filter((f) => /^ds-balance-v\d+\.js$/.test(f))
    assert.equal(files.length, 1, `重复运行后应仍只有一个文件: ${files.join(',')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
