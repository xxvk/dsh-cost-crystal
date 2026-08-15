// 服务契约的最小局部类型 + 注入工具。运行时由 dsh web profile 提供,这里只声明最小契约。

export interface Credentials {
  resolve(ref: string): Promise<{ value: string } | undefined>
}

export interface ShellRequest {
  command: string
  env?: Record<string, string>
  timeoutMs?: number
  stdoutMaxBytes?: number
}

export interface Shell {
  resolve(req: ShellRequest): unknown
  run(spec: unknown): Promise<{ exitCode: number | null; stdout: { text: string } }>
}

export interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: unknown, res: ServerResponse) => void | Promise<void>
}

export interface ServerResponse {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

export interface WebServer {
  register(route: WebRoute): () => void
  tapIndex(transform: (html: string) => string): () => void
}

export interface LiveSession {
  id?: string
}

export interface AgentsService {
  list(): Array<{ session: LiveSession; options: { model?: string } }>
}

export interface SessionProjections {
  snapshot(session: LiveSession): {
    values?: {
      sessionStats?: { decodeMs?: number; decodeTokens?: number }
      tokenUsage?: { outputTokens?: number; uncachedInputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number }
    }
  }
}

export interface Ctx {
  get<T = unknown>(name: string): T | undefined
  effect(fn: () => void | (() => void)): void
}

/**
 * 把脚本注入到 html 的 </body> 之前。
 * 必须用切片拼接——String.replace 会把替换串中的 $& / $' / $$ 按正则语义
 * 展开,破坏含 $ 的脚本(历史 bug,见 test/index.test.mjs)。
 */
export function injectScript(html: string, script: string): string {
  const at = html.indexOf('</body>')
  if (at === -1) return html + script
  return html.slice(0, at) + script + html.slice(at)
}

export const inject = ['credentials', 'shell', 'webServer', 'sessionQuery', 'agents', 'sessionProjections']
