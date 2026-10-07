// 필기·자료·퀴즈를 모아 gzip 압축 후 AES-256-GCM으로 암호화해 public/content.enc 로 저장한다.
// 비밀번호(CPPG_PASS)와 솔트(CPPG_SALT)는 web/.env.local 에서 읽는다 (git 제외).
//   node scripts/encrypt.mjs            → 항상 재생성 (소스 폴더와 비밀번호 필요)
//   node scripts/encrypt.mjs --if-source → 소스 폴더가 없으면(CI) 기존 content.enc 를 그대로 둠
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(here, '..')
const repoRoot = path.resolve(webRoot, '..')
const outFile = path.join(webRoot, 'public', 'content.enc')
const ifSource = process.argv.includes('--if-source')

function loadEnvLocal() {
  const p = path.join(webRoot, '.env.local')
  const env = {}
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return { ...env, ...process.env }
}

const partDirs = fs.existsSync(repoRoot)
  ? fs.readdirSync(repoRoot).filter((n) => /^파트\d/.test(n) && fs.statSync(path.join(repoRoot, n)).isDirectory())
  : []

if (partDirs.length === 0) {
  if (ifSource && fs.existsSync(outFile)) {
    console.log('[encrypt] 소스 폴더 없음 → 기존 content.enc 사용')
    process.exit(0)
  }
  console.error('[encrypt] 파트 폴더를 찾을 수 없습니다:', repoRoot)
  process.exit(1)
}

const env = loadEnvLocal()
const pass = env.CPPG_PASS
let salt = env.CPPG_SALT
if (!pass) {
  if (ifSource && fs.existsSync(outFile)) {
    console.log('[encrypt] CPPG_PASS 없음 → 기존 content.enc 사용')
    process.exit(0)
  }
  console.error('[encrypt] web/.env.local 에 CPPG_PASS 가 필요합니다')
  process.exit(1)
}
if (!salt) {
  salt = crypto.randomBytes(16).toString('base64')
  fs.appendFileSync(path.join(webRoot, '.env.local'), `\nCPPG_SALT=${salt}\n`)
  console.log('[encrypt] CPPG_SALT 생성해 .env.local 에 추가')
}

// 1) 콘텐츠 수집: 파트*/**/*.md, 파트*/**/퀴즈.json (사진·원본 자료 제외)
const entries = []
function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    const r = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) walk(abs, r)
    else if (e.name.endsWith('.md') || e.name === '퀴즈.json') entries.push({ path: r, content: fs.readFileSync(abs, 'utf8') })
  }
}
for (const d of partDirs.sort()) walk(path.join(repoRoot, d), d)

const plain = Buffer.from(JSON.stringify({ v: 1, builtAt: new Date().toISOString(), entries }), 'utf8')
const gz = zlib.gzipSync(plain, { level: 9 })

// 2) 키 유도 + 암호화 (브라우저 WebCrypto 와 동일 파라미터)
const ITER = 600000 // OWASP 권장(PBKDF2-SHA256). 추측 1회 비용을 높인다
const key = crypto.pbkdf2Sync(Buffer.from(pass, 'utf8'), Buffer.from(salt, 'base64'), ITER, 32, 'sha256')
const iv = crypto.randomBytes(12)
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
const data = Buffer.concat([cipher.update(gz), cipher.final(), cipher.getAuthTag()]) // WebCrypto 형식: 암호문 + 태그

const header = { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt, iv: iv.toString('base64'), gzip: true, size: plain.length }
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify({ ...header, data: data.toString('base64') }))
console.log(`[encrypt] ${entries.length} files, ${(plain.length / 1024).toFixed(0)} KB → gzip ${(gz.length / 1024).toFixed(0)} KB → ${path.relative(repoRoot, outFile)} ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`)
