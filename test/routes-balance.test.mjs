// /ds-balance 路由行为 + 预测(带 mock 服务)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mockServices, activate, fakeRes } from './helpers.mjs'

// /ds-balance 路由行为 + 性能缓存 + 预测(带 mock 服务)。
test('/ds-balance 路由:返回余额 + period + usage24h', async () => {
  const mock = mockServices()
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance' }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, true)
  assert.equal(body.isAvailable, true)
  assert.equal(body.infos[0].currency, 'CNY')
  assert.equal(body.infos[0].total, '100.00')
  assert.ok(['peak', 'offpeak'].includes(body.period.mode))
  assert.equal(typeof body.period.nextAt, 'number')
  assert.deepEqual(body.period.windowsUtc, [[1, 4], [6, 10]])
  assert.ok(body.usage24h.calls >= 2)
  assert.ok(typeof body.asOf === 'number', '应返回数据时效 asOf')
  assert.ok(Math.abs(body.asOf - Date.now()) < 5000, 'asOf 应接近当前时间')
})

test('/ds-balance 路由:未配置 key 返回 no-key(period/usage24h 键被 JSON 省略)', async () => {
  const mock = mockServices({ credentials: { resolve: async () => undefined } })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance' }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, false)
  assert.equal(body.reason, 'no-key')
  assert.ok(body.period, 'period 始终附加')
})

test('/ds-balance 路由:shell 失败返回 http 错误', async () => {
  const mock = mockServices({ shell: { resolve: (r) => r, run: async () => ({ exitCode: 7, stdout: { text: '' } }) } })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance' }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, false)
  assert.equal(body.reason, 'http')
  assert.equal(body.code, 7)
})

test('/ds-balance 路由:带 session 参数时返回来源(provider/model)', async () => {
  const mock = mockServices({
    sessionQuery: {
      listSessions: async () => [{ header: { id: 's1' } }],
      readSession: async () => ({
        events: [
          { type: 'request/header', time: 1, data: { header: { config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } } } },
        ],
      }),
    },
  })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance?session=s1' }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, true)
  assert.deepEqual(body.source, { provider: 'deepseek-official', model: 'deepseek-v4-flash' })
})

test('/ds-balance 路由:会话无 request/header 时 source 为 null', async () => {
  // 用独立会话 id(s2)避免命中上一个测试缓存的 s1 source
  const mock = mockServices({
    sessionQuery: {
      listSessions: async () => [{ header: { id: 's2' } }],
      readSession: async () => ({ events: [{ time: 1, data: { usage: { outputTokens: 1 } } }] }),
    },
  })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance' }, res)
  assert.equal(JSON.parse(res.body).source, null)
})

test('/ds-balance 路由:负载含 activity(active/tps)', async () => {
  const now = Date.now()
  const mock = mockServices({
    sessionQuery: {
      listSessions: async () => [{ header: { id: 's3' } }],
      readSession: async () => ({
        events: [
          { time: now - 3000, data: { usage: { outputTokens: 3000 } } },
          { type: 'request/header', time: now - 3000, data: { header: { config: { provider: 'deepseek-official', model: 'm' } } } },
        ],
      }),
    },
  })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance?session=s3' }, res)
  const body = JSON.parse(res.body)
  assert.ok(body.activity, '应有 activity')
  assert.equal(body.activity.active, true)
  assert.equal(body.activity.tps, 50) // 3000/60
})

test('/ds-balance 路由:会话无实时投影时回退日志速率', async () => {
  const now = Date.now()
  const mock = mockServices({
    sessionQuery: {
      listSessions: async () => [{ header: { id: 's6' } }],
      readSession: async () => ({ events: [{ time: now - 3000, data: { usage: { outputTokens: 6000 } } }] }),
    },
    sessions: { get: () => undefined },
    sessionProjections: { snapshot: () => ({ values: {} }) },
  })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance?session=s6' }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.activity.tps, 100) // 6000/60 日志回退
  assert.equal(body.activity.live, false)
})

test('/ds-balance 路由:返回 prediction(下一条预测)', async () => {
  const mock = mockServices()
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance' }, res)
  const body = JSON.parse(res.body)
  assert.ok(body.prediction, '应有下一条预测')
  assert.ok(body.prediction.totalTokens > 0, '应有预测 token 数')
  assert.equal(typeof body.prediction.costCny, 'number')
})

test('/ds-balance 路由:prediction 用当前会话 agent 的 model(非历史)', async () => {
  const now = Date.now()
  const mock = mockServices({
    sessionQuery: {
      listSessions: async () => [{ header: { id: 's9' } }],
      readSession: async () => ({ events: [
        { time: now - 4000, data: { usage: { inputTokens: 1000, outputTokens: 300 }, source: { model: 'deepseek-v4-flash' } } },
      ] }),
    },
    agents: { list: () => [{ session: { id: 's9' }, options: { model: 'deepseek-v4-pro' } }] },
  })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance?session=s9' }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.prediction.model, 'deepseek-v4-pro', '预测应按当前选中模型(agent.options.model)计价')
})

test('/ds-balance 路由:?model= 参数优先于 agent.options.model', async () => {
  const now = Date.now()
  const mock = mockServices({
    sessionQuery: {
      listSessions: async () => [{ header: { id: 's10' } }],
      readSession: async () => ({ events: [
        { time: now - 4000, data: { usage: { inputTokens: 1000, outputTokens: 300 } } },
      ] }),
    },
    agents: { list: () => [{ session: { id: 's10' }, options: { model: 'deepseek-v4-pro' } }] },
  })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-balance')
  const res = fakeRes()
  await route.handler({ url: '/ds-balance?session=s10&model=deepseek-v4-flash' }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.prediction.model, 'deepseek-v4-flash', '请求 model 参数应优先于 agent.options.model')
})

