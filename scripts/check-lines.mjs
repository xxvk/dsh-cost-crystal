// 行数规则检查:源码(默认 src/ 与 test/)超 300 行报错(硬上限),200–300 行警告(理想 ≤200)。
// 到 300 就该动手拆了(拆成多个 plugin / 抽 helper),不要靠删注释、压缩来勉强压线。
// 生成物(lib/、dist/、node_modules)豁免——它们由构建生成、镜像源码结构,不参与人工维护。
// 用法: node scripts/check-lines.mjs [dir...]   (默认: src test)
// 行数按 wc -l 语义(换行符数量)统计。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const HARD = 300
const RECOMMENDED = 200
const IGNORED_DIRS = new Set(['node_modules', 'lib', 'dist', '.git', 'coverage'])
// 生成物文件(精确 basename):由 build-scripts 从 inline.js 生成,禁止手改,豁免行数
const IGNORED_FILES = new Set(['card-script.ts', 'cost-script.ts'])
const EXTS = new Set(['.ts', '.tsx', '.mjs', '.js', '.cjs', '.mts', '.cts'])

const dirs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['src', 'test']

function collect(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (IGNORED_DIRS.has(name) || IGNORED_FILES.has(name)) continue
    const st = statSync(p)
    if (st.isDirectory()) collect(p, out)
    else if (EXTS.has(extname(p))) out.push(p)
  }
}

const files = []
for (const d of dirs) collect(d, files)

let bad = false
let warned = 0
for (const f of files) {
  const n = (readFileSync(f, 'utf8').match(/\n/g) ?? []).length
  if (n > HARD) {
    console.error(`✖ ${f}: ${n} 行(超过硬上限 ${HARD},请拆分文件)`)
    bad = true
  } else if (n >= RECOMMENDED) {
    console.warn(`⚠ ${f}: ${n} 行(推荐 ≤${RECOMMENDED},超过 ${HARD} 将报错)`)
    warned++
  }
}

if (bad) {
  console.error(`行数规则未通过:存在超过 ${HARD} 行的文件`)
  process.exit(1)
}
console.log(`✅ 行数规则通过(${files.length} 个文件${warned > 0 ? `,${warned} 个接近上限` : ''})`)
