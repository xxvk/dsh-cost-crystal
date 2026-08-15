// 会话日志用量读取:通过 Host 的 sessionQuery 服务读取会话事件并汇总费用。
// 仅使用服务契约的最小局部类型,不引入 @deepseek-ai/* 运行时依赖。

import { priceAt, costOf, type TokenUsage } from './pricing'

/** sessionQuery 服务的最小契约(运行时由 dsh web profile 提供) */
export interface SessionQuery {
  listSessions(): Promise<Array<{ header?: { id?: string } }>>
  readSession(id: string): Promise<{ events?: SessionEvent[] }>
}

export function modelOf(ev: SessionEvent): string {
  const d = ev.data as { message?: { source?: { model?: string } }; source?: { model?: string } } | undefined
  return d?.message?.source?.model ?? d?.source?.model ?? 'unknown'
}

export interface SessionEvent {
  type?: string
  time?: number
  data?: {
    usage?: TokenUsage
    header?: {
      config?: {
        provider?: string
        model?: string
      }
    }
  }
}


export interface Usage24hResult {
  usd: number
  cny: number
  flatUsd: number
  peakUsd: number
  offUsd: number
  calls: number
  asOf: number
}


/** 近 24 小时全部会话的累计费用估算 */
export async function usage24h(sq: SessionQuery, nowMs: number): Promise<Usage24hResult | null> {
  const cutoff = nowMs - 24 * 3600 * 1000
  const out: Usage24hResult = { usd: 0, cny: 0, flatUsd: 0, peakUsd: 0, offUsd: 0, calls: 0, asOf: nowMs }
  let sessions: Array<{ header?: { id?: string } }> = []
  try {
    sessions = await sq.listSessions()
  } catch {
    return null
  }
  for (const rec of sessions) {
    const id = rec.header?.id
    if (!id) continue
    let snapshot: { events?: SessionEvent[] } | null = null
    try {
      snapshot = await sq.readSession(id)
    } catch {
      continue
    }
    for (const ev of snapshot?.events ?? []) {
      if (typeof ev.time !== 'number' || ev.time < cutoff) continue
      const u = ev.data?.usage
      if (!u) continue
      if ((u.inputTokens || 0) + (u.cacheReadTokens || 0) + (u.outputTokens || 0) <= 0) continue
      const unit = priceAt(modelOf(ev), ev.time)
      const c = costOf(u, unit)
      out.usd += c.costUsd
      out.cny += c.cost
      if (unit.mode === 'flat') out.flatUsd += c.costUsd
      else if (unit.mode === 'peak') out.peakUsd += c.costUsd
      else out.offUsd += c.costUsd
      out.calls++
    }
  }
  return out
}

export interface SessionSource {
  provider: string
  model: string | null
}

/** 会话最近的模型来源:最后一个 request/header 事件的 provider/model */
export async function sessionSource(sq: SessionQuery, sessionId: string): Promise<SessionSource | null> {
  let snapshot: { events?: SessionEvent[] } | null = null
  try {
    snapshot = await sq.readSession(sessionId)
  } catch {
    return null
  }
  return computeSource(snapshot?.events ?? [])
}

/** 纯计算:从事件列表提取最近的 provider/model(与 readSession 解耦,可复用于合并读取) */
export function computeSource(events: SessionEvent[]): SessionSource | null {
  let provider: string | null = null
  let model: string | null = null
  for (const ev of events) {
    if (ev.type === 'request/header') {
      const cfg = ev.data?.header?.config
      if (cfg?.provider) {
        provider = cfg.provider
        model = cfg.model ?? model
      }
    }
  }
  return provider ? { provider, model } : null
}

export interface SessionActivity {
  active: boolean
  tps: number
}

/**
 * 会话活动度:近 60s 输出 tokens 求速率(tps),近 20s 内有事件判定运行中。
 * 呼吸灯脉动频率与「速率 tok/s」显示的数据源。
 */
export async function sessionActivity(sq: SessionQuery, sessionId: string): Promise<SessionActivity | null> {
  let snapshot: { events?: SessionEvent[] } | null = null
  try {
    snapshot = await sq.readSession(sessionId)
  } catch {
    return null
  }
  const events = snapshot?.events ?? []
  const now = Date.now()
  let lastTime = 0
  let outputInWindow = 0
  for (const ev of events) {
    if (typeof ev.time === 'number') {
      if (ev.time > lastTime) lastTime = ev.time
      if (ev.time >= now - 60000) outputInWindow += ev.data?.usage?.outputTokens ?? 0
    }
  }
  if (lastTime === 0) return { active: false, tps: 0 }
  return {
    active: now - lastTime < 20000,
    tps: Math.round(outputInWindow / 60),
  }
}


