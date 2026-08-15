// 会话活动(呼吸灯/速率)与下一条预测:都围绕 live agent 与投影/日志,内聚在此。

import type { AgentsService, SessionProjections } from './types'
import { activityCache, predictionCache, cacheState } from './caches'
import { sessionActivity, type SessionQuery } from './usage'
import { predictNext } from './predict'

export function createActivity(agents: AgentsService | undefined, projections: SessionProjections | undefined, sessionQuery: SessionQuery | undefined) {
  // 全局近实时活动检测(dsh-token-panel 同款):汇总所有 live 会话的 tokenUsage.outputTokens,
  // 两次采样间增量 / 时间 = 实时 tok/s。增长=运行中,停滞=空闲;首次采样无前值 → 空闲。
  function activityFromProjection(): { active: boolean; tps: number; live: true } | null {
    if (!agents || !projections) return null
    try {
      let totalOutput = 0
      let hasAny = false
      for (const agent of agents.list()) {
        const session = agent.session
        if (!session) continue
        const tokenUsage = projections.snapshot(session)?.values?.tokenUsage
        if (tokenUsage && typeof tokenUsage.outputTokens === 'number') {
          totalOutput += tokenUsage.outputTokens
          hasAny = true
        }
      }
      if (!hasAny) return null // 无 live 会话/投影 → 回退日志估算
      const now = Date.now()
      const prev = cacheState.globalTpsState
      let active = false
      let tps = 0
      if (prev !== null) {
        const dt = Math.max(1, now - prev.at)
        const delta = Math.max(0, totalOutput - prev.output)
        tps = delta / (dt / 1000)
        active = delta > 0
      }
      cacheState.globalTpsState = { output: totalOutput, at: now }
      return { active, tps, live: true }
    } catch {
      return null
    }
  }

  // 当前会话选中的模型:live agent 的 options.model(token-panel 同源)。
  function currentModel(sessionId: string): string | null {
    if (!agents) return null
    for (const agent of agents.list()) {
      if (agent.session && agent.session.id === sessionId) return agent.options?.model ?? null
    }
    return null
  }

  async function cachedSessionActivity(sessionId: string): Promise<unknown> {
    if (!sessionQuery) return null
    const hit = activityCache.get(sessionId)
    if (hit !== undefined && Date.now() - hit.at < 30000) return hit.data
    const data = await sessionActivity(sessionQuery, sessionId)
    activityCache.set(sessionId, { at: Date.now(), data }) // 负缓存
    return data
  }

  async function activityFor(sessionId: string): Promise<unknown> {
    const base = await cachedSessionActivity(sessionId)
    if (base === null) return null
    return { active: (base as { active: boolean }).active, tps: (base as { tps: number }).tps, live: false }
  }

  // 下一条预测:读会话较重,60s 缓存;model 变化立即重算(切换模型即时反映价格)
  async function cachedPrediction(sessionId: string, modelHint?: string | null): Promise<unknown> {
    if (!sessionQuery) return null
    const model = modelHint && modelHint.trim() ? modelHint : currentModel(sessionId)
    const hit = predictionCache.get(sessionId)
    if (hit !== undefined && Date.now() - hit.at < 60000 && hit.model === model) return hit.data
    const data = await predictNext(sessionQuery, sessionId, model)
    if (data !== null) predictionCache.set(sessionId, { at: Date.now(), data, model })
    return data
  }

  return { activityFromProjection, currentModel, cachedSessionActivity, activityFor, cachedPrediction }
}
