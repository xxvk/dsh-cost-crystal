// 发布一致性:仓库 cordis.patch.yml 声明的服务必须与 src/types.ts 的 inject 完全一致。
// 漂移会让 npm 安装后的插件拿不到 agents/sessionProjections,近实时速率降级为日志判定。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
const types = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8')

test('cordis.patch.yml 的 inject 与 src/types.ts 一致(不缺服务)', () => {
  const m = types.match(/export const inject = \[(.*?)\]/)
  assert.ok(m, 'src/types.ts 应导出 inject 数组')
  const services = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
  assert.ok(services.length >= 4, '应有完整服务列表')
  for (const svc of services) {
    assert.ok(patch.includes(svc), `patch 应声明服务 ${svc}(否则 npm 安装后拿不到)`)
  }
})
