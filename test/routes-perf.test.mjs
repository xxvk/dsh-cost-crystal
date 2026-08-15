// 缓存性能测试:余额/activity 在 TTL 内只打一次上游(带 mock 服务)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mockServices, activate, fakeRes } from './helpers.mjs'

test('性能:余额有缓存——30s 内两次请求只打一次上游 curl', async () => {
  let shellCalls = 0
  const mock = mockServices({
    shell: {
      resolve: (r) => r,
      run: async () => { shellCalls++; return { exitCode: 0, stdout: { text: JSON.stringify({ is_available: true, balance_infos: [] }) } } },
    },
  })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  await route.handler({ url: '/ds-balance?session=s7' }, fakeRes())
  await route.handler({ url: '/ds-balance?session=s7' }, fakeRes())
  assert.equal(shellCalls, 1, '第二次应命中余额缓存,不再 curl')
})

test('性能:activity 有缓存——TTL 内两次请求只读一次会话', async () => {
  let reads = 0
  const now = Date.now()
  const mock = mockServices({
    sessionQuery: {
      listSessions: async () => [{ header: { id: 's8' } }],
      readSession: async () => { reads++; return { events: [{ time: now - 3000, data: { usage: { outputTokens: 100 } } }] } },
    },
  })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  await route.handler({ url: '/ds-balance?session=s8' }, fakeRes())
  const readsBefore = reads
  await route.handler({ url: '/ds-balance?session=s8' }, fakeRes())
  assert.equal(reads, readsBefore, '第二次应命中全部缓存,不再读会话')
})
