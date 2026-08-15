// 路由行为测试:/ds-activity(投影增量检测)与费用+来源合并读取。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plugin, mockServices, activate, fakeRes } from './helpers.mjs'

test('/ds-activity 路由:tokenUsage.outputTokens 增量 → 运行中/速率(token-panel 同款)', async () => {
  let output = 1000
  const agents = { list: () => [{ session: { id: 's1' } }] }
  const projections = { snapshot: () => ({ values: { tokenUsage: { outputTokens: output } } }) }
  const mock = mockServices({ agents, sessionProjections: projections })
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-activity')
  const res = fakeRes()
  await route.handler({ url: '/ds-activity?session=s1' }, res)
  let body = JSON.parse(res.body)
  assert.equal(body.ok, true)
  assert.equal(typeof body.asOf, 'number')
  assert.equal(body.activity.live, true)
  assert.equal(body.activity.active, false, '首次采样无前值,应空闲')
  assert.equal(body.activity.tps, 0)
  output = 1500 // 输出增长 → 运行中
  const res2 = fakeRes()
  await route.handler({ url: '/ds-activity?session=s1' }, res2)
  body = JSON.parse(res2.body)
  assert.equal(body.activity.active, true)
  assert.ok(body.activity.tps > 0, 'tps 应为增量/时间(>0)')
  const res3 = fakeRes() // 停滞 → 空闲
  await route.handler({ url: '/ds-activity?session=s1' }, res3)
  body = JSON.parse(res3.body)
  assert.equal(body.activity.active, false)
  assert.equal(body.activity.tps, 0)
})

test('/ds-activity 路由:无投影时回退 activityFor(会话日志)', async () => {
  const mock = mockServices()
  const { routes } = activate(mock)
  const route = routes.find((r) => r.path === '/ds-activity')
  const res = fakeRes()
  await route.handler({ url: '/ds-activity?session=s1' }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, true)
  assert.ok(body.activity, '应有 activity')
  assert.equal(typeof body.activity.active, 'boolean')
  assert.equal(typeof body.activity.tps, 'number')
})
