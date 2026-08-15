// dsh-cost-crystal 插件入口(Host 端,CJS 输出由 loader 加载)。
// 注册两个 JSON 路由 + 一个 index.html 注入:
//   /ds-balance     余额 + 波峰/低峰 + 下次调整 + 近24h + 预测
//   /ds-activity    全局实时速率(投影增量检测)
// 注入脚本:右上角余额卡片。注入必须用切片拼接(injectScript)。

import { PEAK_UTC, USD_CNY, modeAt, nextBoundary } from './pricing'
import { usage24h, sessionSource, usageByModel, type SessionQuery } from './usage'
import { CARD_SCRIPT } from './scripts'
import { inject, injectScript, type Ctx, type Credentials, type Shell, type WebRoute, type WebServer, type AgentsService, type SessionProjections } from './types'
import { __resetCaches, sourceCache, byModelCache, cacheState } from './caches'
import { createBalance } from './balance'
import { createActivity } from './activity'

export { injectScript } from './types'
export { __resetCaches } from './caches'
export { USD_CNY }

export function apply(ctx: Ctx): void {
  const credentials = ctx.get<Credentials>('credentials')
  const shell = ctx.get<Shell>('shell')
  const webServer = ctx.get<WebServer>('webServer')
  const sessionQuery = ctx.get<SessionQuery>('sessionQuery')
  const agents = ctx.get<AgentsService>('agents')
  const projections = ctx.get<SessionProjections>('sessionProjections')
  if (!credentials || !shell || !webServer) {
    console.error('dsh-cost-crystal: 缺少 credentials/shell/webServer 服务,插件未启用')
    return
  }

  const { cachedBalance } = createBalance(credentials, shell)
  const { activityFromProjection, activityFor, cachedPrediction } = createActivity(agents, projections, sessionQuery)

  async function cachedUsage24h(): Promise<unknown> {
    if (!sessionQuery) return null
    if (cacheState.usage24hCache.data !== null && Date.now() - cacheState.usage24hCache.at < 300000) return cacheState.usage24hCache.data
    const data = await usage24h(sessionQuery, Date.now())
    if (data !== null) cacheState.usage24hCache = { at: Date.now(), data }
    return data
  }

  async function cachedSessionSource(sessionId: string): Promise<unknown> {
    if (!sessionQuery) return null
    const hit = sourceCache.get(sessionId)
    if (hit !== undefined && Date.now() - hit.at < 60000) return hit.data
    const data = await sessionSource(sessionQuery, sessionId)
    sourceCache.set(sessionId, { at: Date.now(), data }) // 负缓存:null 也缓存
    return data
  }

  // 按 model 分桶用量(读会话重,60s 缓存)
  async function cachedByModel(sessionId: string): Promise<unknown> {
    if (!sessionQuery) return null
    const hit = byModelCache.get(sessionId)
    if (hit !== undefined && Date.now() - hit.at < 60000) return hit.data
    const data = await usageByModel(sessionQuery, sessionId)
    if (data !== null) byModelCache.set(sessionId, { at: Date.now(), data })
    return data
  }

  // 从请求 url 解析 session 参数;缺省回退最新会话
  async function resolveSession(req: unknown): Promise<string | null> {
    try {
      const u = new URL((req as { url?: string }).url ?? '/', 'http://localhost')
      const s = u.searchParams.get('session')
      if (s !== null) return s
    } catch { /* keep null */ }
    if (!sessionQuery) return null
    try {
      const sessions = await sessionQuery.listSessions()
      return sessions[0]?.header?.id ?? null
    } catch {
      return null
    }
  }

  ctx.effect(() => {
    // 路由注册容错:路径可能已被其它插件占用,冲突不致命——记录后继续,tap 必注册。
    const registerRoute = (route: WebRoute): (() => void) => {
      try {
        return webServer.register(route)
      } catch (error) {
        console.error('dsh-cost-crystal: 路由注册失败(路径可能已被占用):', route.path, error instanceof Error ? error.message : String(error))
        return () => {}
      }
    }

    const disposeBalanceRoute = registerRoute({
      kind: 'exact',
      path: '/ds-balance',
      handler: async (req, res) => {
        const now = Date.now()
        const balance = await cachedBalance()
        const sessionId = await resolveSession(req)
        let modelParam: string | null = null
        try {
          modelParam = new URL((req as { url?: string }).url ?? '/', 'http://localhost').searchParams.get('model')
        } catch { /* keep null */ }
        const payload = Object.assign({}, balance, {
          asOf: now,
          period: { mode: modeAt(now), nextAt: nextBoundary(now), windowsUtc: PEAK_UTC },
          usage24h: await cachedUsage24h(),
          source: sessionId ? await cachedSessionSource(sessionId) : null,
          activity: sessionId ? await activityFor(sessionId) : null,
          prediction: sessionId ? await cachedPrediction(sessionId, modelParam) : null,
          byModel: sessionId ? await cachedByModel(sessionId) : null,
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(payload))
      },
    })

    const disposeActivityRoute = registerRoute({
      kind: 'exact',
      path: '/ds-activity',
      handler: async (req, res) => {
        const now = Date.now()
        const sessionId = await resolveSession(req)
        const activity = activityFromProjection() ?? (sessionId === null ? null : (await activityFor(sessionId)))
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ ok: true, asOf: now, activity }))
      },
    })

    const disposeCardTap = webServer.tapIndex((html) => injectScript(html, CARD_SCRIPT))

    return () => {
      disposeBalanceRoute()
      disposeActivityRoute()
      disposeCardTap()
    }
  })
}

export default { inject, apply }
