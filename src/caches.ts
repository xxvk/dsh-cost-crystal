// 模块级缓存状态 + 测试钩子。缓存分层:读会话/上游都很重,轮询短但缓存长。

export const predictionCache = new Map<string, { at: number; data: unknown; model: string | null }>()
export const sourceCache = new Map<string, { at: number; data: unknown }>()
export const activityCache = new Map<string, { at: number; data: unknown }>()

// 可变状态(对象包装,避免 ES module import 只读绑定不可重赋值)
export const cacheState = {
  // 投影增量检测:记录上次 outputTokens 总和,增长=正在消耗(内存操作,近实时)
  globalTpsState: null as { output: number; at: number } | null,
  // 余额缓存:路由 10s 轮询但上游 curl 只需 30s 一次
  balanceCache: { at: 0, data: null as Record<string, unknown> | null },
  // 24h 用量缓存:全量扫描所有会话很重,300s 一次
  usage24hCache: { at: 0, data: null as unknown | null },
}

/** 测试钩子:清空全部缓存(测试隔离用,loader 忽略多余导出) */
export function __resetCaches(): void {
  predictionCache.clear()
  sourceCache.clear()
  activityCache.clear()
  cacheState.globalTpsState = null
  cacheState.balanceCache = { at: 0, data: null }
  cacheState.usage24hCache = { at: 0, data: null }
}
