// [已停用 v0.1] 会话费用计算:费用行功能暂移出插件,保留存档待调教(见 TODO.md)。
import { costOf, priceAt } from './pricing'
import { modelOf, computeSource, type SessionEvent, type SessionSource, type SessionQuery } from './usage'

export interface SessionCostResult {
  usd: number
  cny: number
  flatUsd: number
  peakUsd: number
  offUsd: number
  calls: number
  input: number
  hit: number
  output: number
  asOf: number
}

/** 单个会话累计费用(按每条记录时间点归属波峰/低峰计价) */
export async function sessionCost(sq: SessionQuery, sessionId: string): Promise<SessionCostResult | null> {
  let snapshot: { events?: SessionEvent[] } | null = null
  try {
    snapshot = await sq.readSession(sessionId)
  } catch {
    return null
  }
  return computeCost(snapshot?.events ?? [], Date.now())
}

/** 纯计算:从事件列表汇总费用(与 readSession 解耦,可复用) */
export function computeCost(events: SessionEvent[], nowMs: number): SessionCostResult {
  const out: SessionCostResult = { usd: 0, cny: 0, flatUsd: 0, peakUsd: 0, offUsd: 0, calls: 0, input: 0, hit: 0, output: 0, asOf: nowMs }
  for (const ev of events) {
    const u = ev.data?.usage
    if (!u) continue
    const t = u.inputTokens || 0
    const h = u.cacheReadTokens || 0
    const o = u.outputTokens || 0
    if (t + h + o <= 0) continue
    out.input += t
    out.hit += h
    out.output += o
    const time = typeof ev.time === 'number' ? ev.time : nowMs
    const unit = priceAt(modelOf(ev), time)
    const c = costOf(u, unit)
    out.usd += c.costUsd
    out.cny += c.cost
    if (unit.mode === 'flat') out.flatUsd += c.costUsd
    else if (unit.mode === 'peak') out.peakUsd += c.costUsd
    else out.offUsd += c.costUsd
    out.calls++
  }
  return out
}

/** 合并读取:一次 readSession 同时计算费用与来源,避免同一会话读两遍 */
export async function sessionCostWithSource(
  sq: SessionQuery,
  sessionId: string,
): Promise<{ cost: SessionCostResult; source: SessionSource | null } | null> {
  let snapshot: { events?: SessionEvent[] } | null = null
  try {
    snapshot = await sq.readSession(sessionId)
  } catch {
    return null
  }
  const events = snapshot?.events ?? []
  return { cost: computeCost(events, Date.now()), source: computeSource(events) }
}
