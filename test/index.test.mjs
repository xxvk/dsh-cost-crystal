// 插件 apply 基础:注入、路由注册、disposer、回归(带 mock 服务)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { injectScript } from '../lib/index.js'
import { plugin, mockServices, activate, fakeRes } from './helpers.mjs'

test('插件形状:inject 与 apply 就位', () => {
  assert.deepEqual(plugin.inject, ['credentials', 'shell', 'webServer', 'sessionQuery', 'agents', 'sessionProjections'])
  assert.equal(typeof plugin.apply, 'function')
})

test('apply 注册两个路由与一个 tap', () => {
  const mock = mockServices()
  const { routes, taps } = activate(mock)
  assert.deepEqual(routes.map((r) => [r.kind, r.path]), [
    ['exact', '/ds-balance'],
    ['exact', '/ds-activity'],
  ])
  assert.equal(taps.length, 1)
})

test('回归:注入脚本保留 $ 字符(切片注入,不用 String.replace)', () => {
  const mock = mockServices()
  const { taps } = activate(mock)
  const html = '<html><body>hi</body></html>'
  const out = taps[0](html)
  // 卡片脚本内含 '$' 与 '$'(USD 符号、费用明细),必须原样保留
  assert.ok(out.includes("? '$' : b.currency"), 'USD 符号字符串应保留')
  assert.ok(out.includes("'平峰 $'") || out.includes("'波峰 $'"), '费用明细中的 $ 应保留')
  assert.ok(!out.includes('</html>\n : b.currency'), '不应出现 $ 被展开的破坏痕迹')
  // 注入位置正确
  assert.ok(out.startsWith('<html><body>hi'))
  assert.ok(out.endsWith('</body></html>'))
})

test('injectScript:无 </body> 时追加到末尾', () => {
  assert.equal(injectScript('<html>no body', '<script>x</script>'), '<html>no body<script>x</script>')
})

test('injectScript:有 </body> 时插入其前', () => {
  assert.equal(injectScript('<html><body>x</body></html>', 'S'), '<html><body>xS</body></html>')
})

test('disposer 会依次释放路由与 tap', () => {
  const mock = mockServices()
  plugin.apply(mock.ctx)
  const dispose = mock.svc._effect()
  const { routes, taps } = mock.svc.webServer
  dispose()
  for (const r of routes) assert.equal(r._disposed, true)
  for (const t of taps) assert.equal(t._disposed, true)
})
test('回归:路由重复注册不致命,tap 仍全部注册(卡片不丢失)', () => {
  const taps = []
  const routes = []
  const webServer = {
    register: (route) => {
      if (route.path === '/ds-activity') throw new Error('webserver: duplicate exact route "/ds-activity"')
      routes.push(route)
      return () => { route._disposed = true }
    },
    tapIndex: (fn) => { taps.push(fn); return () => { fn._disposed = true } },
  }
  const credentials = { resolve: async () => undefined }
  const shell = { resolve: (r) => r, run: async () => ({ exitCode: 1, stdout: { text: '' } }) }
  const sessionQuery = { listSessions: async () => [], readSession: async () => ({ events: [] }) }
  const svc = { credentials, shell, sessionQuery, webServer }
  const ctx = { get: (n) => svc[n], effect: (fn) => { svc._effect = fn } }
  assert.doesNotThrow(() => { plugin.apply(ctx); svc._effect() }, 'apply 不应因路由冲突崩溃')
  assert.equal(taps.length, 1, '卡片 tap 仍注册(费用 tap 已移除)')
  assert.deepEqual(routes.map((r) => r.path), ['/ds-balance'], '非冲突路由正常注册(activity 冲突跳过)')
})
