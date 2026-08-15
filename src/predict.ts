// 下一条消息预测(简单版,逐步优化):结合当前上下文长度与历史输入/输出均值,
// 估算下一条请求的 token 消耗与费用。上下文按缓存命中价,新输入按未命中价。
import { costOf, priceAt } from './pricing'
import { modelOf, type SessionEvent, type SessionQuery } from './usage'

export interface NextPrediction {
  contextTokens: number // 当前上下文(累计 input+cacheRead)
  avgInput: number // 历史平均单次输入
  avgOutput: number // 历史平均单次输出
  predictedInput: number // context + avgInput
  predictedOutput: number // avgOutput(无历史时按上下文 20% 兜底)
  totalTokens: number
  costCny: number
  costUsd: number
  model: string | null
  asOf: number
}

export async function predictNext(sq: SessionQuery, sessionId: string, modelHint?: string | null): Promise<NextPrediction | null> {
  let snapshot: { events?: SessionEvent[] } | null = null
  try {
    snapshot = await sq.readSession(sessionId)
  } catch {
    return null
  }
  const now = Date.now()
  let context = 0
  let histModel: string | null = null
  const inputs: number[] = []
  const outputs: number[] = []
  for (const ev of snapshot?.events ?? []) {
    const u = ev.data?.usage
    if (!u) continue
    const t = u.inputTokens || 0
    const h = u.cacheReadTokens || 0
    const o = u.outputTokens || 0
    if (t + h + o <= 0) continue
    if (t + h > 0) context = t + h
    if (t > 0) inputs.push(t)
    if (o > 0) outputs.push(o)
    histModel = modelOf(ev)
  }
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const avgInput = inputs.length ? Math.round(sum(inputs) / inputs.length) : 0
  const avgOutput = outputs.length
    ? Math.round(sum(outputs) / outputs.length)
    : Math.max(50, Math.round(context / 5))
  const predictedInput = context + avgInput
  const predictedOutput = avgOutput
  const model = modelHint && modelHint.trim() ? modelHint : histModel
  const unit = priceAt(model ?? 'unknown', now)
  const c = costOf(
    { inputTokens: avgInput, cacheReadTokens: context, outputTokens: predictedOutput },
    unit,
  )
  return {
    contextTokens: context,
    avgInput,
    avgOutput,
    predictedInput,
    predictedOutput,
    totalTokens: predictedInput + predictedOutput,
    costCny: c.cost,
    costUsd: c.costUsd,
    model,
    asOf: now,
  }
}
