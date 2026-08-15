// 余额查询:curl 官方 balance 接口。key 只经 env 传 curl,不进命令行参数;30s 缓存。

import type { Credentials, Shell } from './types'
import { cacheState } from './caches'

export function createBalance(credentials: Credentials, shell: Shell) {
  async function fetchBalance(): Promise<Record<string, unknown>> {
    const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
    if (!resolved) return { ok: false, reason: 'no-key' }
    const spec = shell.resolve({
      command: 'curl -sf -m 10 https://api.deepseek.com/user/balance -H "Authorization: Bearer $DS_KEY"',
      env: { DS_KEY: resolved.value },
      timeoutMs: 15000,
      stdoutMaxBytes: 4096,
    })
    const result = await shell.run(spec)
    if (result.exitCode !== 0) return { ok: false, reason: 'http', code: result.exitCode }
    try {
      const data = JSON.parse(result.stdout.text) as {
        is_available?: boolean
        balance_infos?: Array<{ currency?: string; total_balance?: string; granted_balance?: string; topped_up_balance?: string }>
        error?: { message?: string } | string
      }
      if (data === null || typeof data !== 'object') return { ok: false, reason: 'parse' }
      if (data.error) {
        const msg = typeof data.error === 'object' ? String(data.error.message ?? '') : String(data.error)
        return { ok: false, reason: 'api', message: msg }
      }
      return {
        ok: true,
        isAvailable: !!data.is_available,
        infos: (Array.isArray(data.balance_infos) ? data.balance_infos : []).map((b) => ({
          currency: typeof b.currency === 'string' ? b.currency : '?',
          total: String(b.total_balance ?? ''),
          granted: String(b.granted_balance ?? ''),
          toppedUp: String(b.topped_up_balance ?? ''),
        })),
      }
    } catch {
      return { ok: false, reason: 'parse' }
    }
  }

  async function cachedBalance(): Promise<Record<string, unknown>> {
    if (cacheState.balanceCache.data !== null && Date.now() - cacheState.balanceCache.at < 30000) return cacheState.balanceCache.data
    const data = await fetchBalance()
    if (data && data.ok === true) cacheState.balanceCache = { at: Date.now(), data }
    return data
  }

  return { fetchBalance, cachedBalance }
}
