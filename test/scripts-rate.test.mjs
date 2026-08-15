// 卡片脚本测试(自动拆分自 scripts.test.mjs)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARD_SCRIPT, COST_SCRIPT } from '../lib/scripts.js'

function jsOf(raw) {
  const js = raw.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '')
  assert.ok(js.length > 100, '脚本不应为空')
  return js
}

// ── 即时显示:localStorage 缓存上次数据,刷新后立即渲染 ─────────────────

test('即时显示:卡片缓存上次数据并在初始化时立即渲染', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('dsh-balance-card-data'), '应有卡片缓存 key')
  assert.ok(js.includes('saveCache(') && js.includes('loadCache()'), '应有缓存读写函数')
  assert.ok(js.includes('localStorage.setItem') && js.includes('localStorage.getItem'), '应使用 localStorage')
  const iSave = js.indexOf('saveCache(d)')
  const iPoll = js.indexOf('function poll')
  assert.ok(iSave > iPoll, '轮询成功后应保存缓存')
  assert.ok(js.includes('if (cached) {') || js.includes('if (cached) render'), '初始化应优先渲染缓存')
})

test('即时显示:费用行也缓存上次数据', () => {
  const js = jsOf(COST_SCRIPT)
  assert.ok(js.includes('dsh-session-cost-data'), '应有费用缓存 key')
  assert.ok(js.includes('saveCostCache') && js.includes('loadCostCache'), '应有费用缓存读写')
})

// ── 路由变慢时的体验保障:轮询防重叠 + 无缓存骨架屏 ────────────────────

test('性能:轮询有防重叠保护(路由慢时不会叠加请求)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('polling') && js.includes('if (polling) return'), '应防止轮询重叠')
  assert.ok(js.includes('polling = false'), '完成后应复位')
})

test('性能:无缓存时立即渲染骨架屏(卡片不空白)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('function renderSkeleton'), '应有骨架渲染函数')
  assert.ok(js.includes('else { renderSkeleton(); }') || js.includes('renderSkeleton();'), '无缓存时调用骨架')
})

// ── 速率数字状态色:有消耗亮绿,空闲清 0 灰显 ──────────────────────────

function extractTpsValue() {
  const js = jsOf(CARD_SCRIPT)
  const m = js.match(/function tpsValue\(activity\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '卡片脚本应包含 tpsValue 函数')
  return new Function(`return (${m[0]})`)()
}

test('速率值:运行中显示实时 tps,空闲清 0(不保留过期值)', () => {
  const f = extractTpsValue()
  assert.equal(f({ active: true, tps: 128 }), 128)
  assert.equal(f({ active: false, tps: 128 }), 0, '空闲应清 0')
  assert.equal(f(undefined), 0)
})

test('速率数字:运行中加亮绿类,数字独立 span', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('ds-balance-card__tpsnum'), '应有速率数字 span 类')
  assert.ok(js.includes('ds-balance-card__tpsnum--on'), '应有运行亮绿类')
  assert.ok(js.includes('fmtTps(tpsValue(data.activity))'), '数字应走 fmtTps(tpsValue)')
})

// ── 时间 label 布局:挪到「余额」上方,同一行上下堆叠,颜色更淡 ─────────

test('布局:时间移到余额 label 上方(amtcol 堆叠,同属金额行)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('ds-balance-card__amtcol'), '应有余额列容器')
  // 时间先于余额 label 加入列(上方)
  const iTime = js.indexOf("'ds-balance-card__time'")
  const iLabel = js.indexOf("'ds-balance-card__amtlabel'")
  assert.ok(iTime !== -1 && iLabel !== -1, '时间与余额 label 都应存在')
  assert.ok(iTime < iLabel, '时间应声明在余额 label 之前(上方)')
  // 头部不再含时间
  const headEnd = js.indexOf('ds-balance-card__head')
  const headBlock = js.slice(headEnd, js.indexOf('function render', headEnd) > 0 ? js.indexOf('ds-balance-card__amtrow') : js.length)
  assert.ok(!js.includes("head.appendChild(makeEl('span', 'ds-balance-card__time'"), '头部不应再渲染时间')
})

test('样式:时间颜色更淡(低透明度)', () => {
  const js = jsOf(CARD_SCRIPT)
  const t = js.match(/\.ds-balance-card__time\{[^}]*\}/)
  assert.ok(t, '应有 time 样式')
  const opacity = t[0].match(/opacity:(\d*\.?\d+)/)
  assert.ok(opacity && Number(opacity[1]) < 0.5, `时间透明度应 <0.5(当前 ${opacity?.[1]})`)
})

test('布局:金额底部与「余额」label 底部对齐(amtrow 用 flex-end)', () => {
  const js = jsOf(CARD_SCRIPT)
  const t = js.match(/\.ds-balance-card__amtrow\{[^}]*\}/)
  assert.ok(t, '应有 amtrow 样式')
  assert.match(t[0], /align-items:\s*flex-end/, `amtrow 应底部对齐,不得用 baseline(当前: ${t[0]})`)
  assert.doesNotMatch(t[0], /align-items:\s*baseline/, '金额不应再按基线对齐(会被 amtcol 首项 time 拽上去)')
})

// ── 速率显示:移入头部左上角,"速率"文字移除;底部 🔮 预测占位 ──

test('速率显示:去掉「速率」文字前缀,仅保留数值+tok/s', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(!js.includes("'速率 '"), '不应再渲染「速率」文字前缀')
  assert.ok(js.includes(' tok/s'), '应保留 tok/s 单位')
})

test('速率显示:位于头部右上角(rate 靠右对齐,位于品牌之后)', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes('.ds-balance-card__rate'), '应有 rate 样式')
  const t = js.match(/\.ds-balance-card__rate\{[^}]*\}/)
  assert.match(t[0], /margin-left:\s*auto/, 'rate 应靠右对齐(右上角)')
  const iHead = js.lastIndexOf("var head = makeEl('div', 'ds-balance-card__head')")
  const iAppend = js.lastIndexOf('root.appendChild(head)')
  const headBlock = js.slice(iHead, iAppend)
  const iBrand = headBlock.indexOf("makeEl('span', 'ds-balance-card__brand'")
  const iRate = headBlock.indexOf("makeEl('span', 'ds-balance-card__rate'")
  assert.ok(iBrand !== -1 && iRate !== -1, 'brand 与 rate 都应在 head 构建块内')
  assert.ok(iRate > iBrand, 'rate 应在品牌之后(头部右上角)')
})

test('速率近实时:独立 /ds-activity 轮询(≤3s)与 applyActivity 轻量更新', () => {
  const js = jsOf(CARD_SCRIPT)
  assert.ok(js.includes("'/ds-activity'"), '应有独立 activity 端点轮询')
  assert.ok(js.includes('function applyActivity'), '应有 applyActivity 轻量更新')
  const p = js.match(/var POLL_ACTIVITY_MS = (\d+)/)
  assert.ok(p && Number(p[1]) <= 3000, `activity 轮询应 ≤3s(当前 ${p?.[1]})`)
  assert.ok(js.includes('setInterval(pollActivity'), 'activity 轮询应启动')
})

test('applyActivity:只更新动画触发点(dot/brand/rate),不重建卡片', () => {
  const js = jsOf(CARD_SCRIPT)
  const m = js.match(/function applyActivity\(a\) \{[\s\S]*?\n  \}/)
  assert.ok(m, '应有 applyActivity 函数')
  assert.ok(m[0].includes('ds-balance-card__dot--active'), 'dot 呼吸灯由 applyActivity 点亮')
  assert.ok(m[0].includes('ds-balance-card__brand--active'), '品牌 shimmer 由 applyActivity 点亮')
  assert.ok(m[0].includes('tpsValue(a)'), '速率文本由 applyActivity 实时更新')
})


test('速率 label:空闲(0 tok/s)时隐藏,运行中显示(--on)', () => {
  const js = jsOf(CARD_SCRIPT)
  const t = js.match(/\.ds-balance-card__rate\{[^}]*\}/)
  assert.ok(t, '应有 rate 样式')
  assert.match(t[0], /display:\s*none/, 'rate 默认隐藏(空闲不显示)')
  assert.ok(js.includes('ds-balance-card__rate--on'), '应有运行中显示类')
  assert.ok(!js.includes('ds-balance-card__rate--idle'), '不再用 idle 降透明度,改为直接隐藏')
})
