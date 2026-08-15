// 路由测试公共 helper:mock 服务 + 激活插件 + 假响应。
import mod, { __resetCaches } from '../lib/index.js'

export const plugin = mod.default ?? mod

export function mockServices(overrides = {}) {
  const routes = []
  const taps = []
  const webServer = {
    register: (route) => { routes.push(route); return () => { route._disposed = true } },
    tapIndex: (fn) => { taps.push(fn); return () => { fn._disposed = true } },
    routes,
    taps,
  }
  const credentials = {
    resolve: async (ref) => (ref === 'DEEPSEEK_API_KEY' ? { value: 'sk-test' } : undefined),
  }
  const shell = {
    resolve: (req) => req,
    run: async () => ({
      exitCode: 0,
      stdout: {
        text: JSON.stringify({
          is_available: true,
          balance_infos: [
            { currency: 'CNY', total_balance: '100.00', granted_balance: '0.00', topped_up_balance: '100.00' },
            { currency: 'USD', total_balance: '0.00', granted_balance: '0.00', topped_up_balance: '0.00' },
          ],
        }),
      },
    }),
  }
  const usageEvent = (time, u) => ({ time, data: { usage: u } })
  const sessionQuery = {
    listSessions: async () => [{ header: { id: 's1' } }],
    readSession: async (id) => ({
      events: [
        usageEvent(Date.UTC(2026, 7, 17, 8), { inputTokens: 1000000 }), // 08:00 UTC → peak
        usageEvent(Date.UTC(2026, 7, 17, 5), { outputTokens: 1000000 }), // 05:00 UTC → offpeak
      ],
    }),
  }
  const svc = { credentials, shell, webServer, sessionQuery, ...overrides }
  const ctx = { get: (name) => svc[name], effect: (fn) => { svc._effect = fn } }
  return { svc, ctx }
}

/** 激活插件并返回 webServer mock */
export function activate(mock) {
  __resetCaches()
  plugin.apply(mock.ctx)
  const disposer = mock.svc._effect()
  return mock.svc.webServer
}

export function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(n, v) { this.headers[n] = v },
    end(body) { this.body = body },
  }
}
