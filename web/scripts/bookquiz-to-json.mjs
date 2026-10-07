// 적중 예상문제/문제.md → 적중 예상문제/퀴즈.json  (연습문제와 같은 인터랙티브 형식)
// 사용: node scripts/bookquiz-to-json.mjs   (모든 파트의 적중 예상문제 폴더를 처리)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CIRC = { '①': 0, '②': 1, '③': 2, '④': 3, '⑤': 4 }

function parse(md) {
  const lines = md.split(/\r?\n/)
  const blocks = []
  let cur = null
  for (const line of lines) {
    const h = line.match(/^###\s+Q(\d+)\.\s*(.*)$/)
    if (h) {
      cur = { id: Number(h[1]), stem: h[2].trim(), body: [] }
      blocks.push(cur)
      continue
    }
    if (/^##\s/.test(line)) cur = null // 자주 나오는 포인트 등 종료
    if (cur) cur.body.push(line)
  }
  const out = []
  for (const b of blocks) {
    const body = b.body
    const firstChoice = body.findIndex((l) => /^\s*\d+\.\s/.test(l))
    if (firstChoice < 0) continue
    const pre = body
      .slice(0, firstChoice)
      .map((l) => l.replace(/^>\s?/, '').trim())
      .filter((l) => l && l !== '---')
    const choices = []
    let i = firstChoice
    for (; i < body.length; i++) {
      const m = body[i].match(/^\s*(\d+)\.\s+(.*)$/)
      if (m) choices.push(m[2].trim())
      else if (body[i].trim() === '' && choices.length) {
        // 빈 줄 뒤에 또 선택지가 이어지면 계속
        if (/^\s*\d+\.\s/.test(body[i + 1] || '')) continue
        break
      } else if (choices.length) break
    }
    const rest = body
      .slice(i)
      .map((l) => l.replace(/^>\s?/, ''))
      .join('\n')
    const am = rest.match(/\*\*정답:\*\*\s*([①-⑤]|\d)/)
    if (!am) throw new Error(`정답 없음: Q${b.id}`)
    const answer = am[1] in CIRC ? CIRC[am[1]] : Number(am[1]) - 1
    const em = rest.split(/\*\*해설:\*\*/)
    let explanation = (em[1] ?? '').trim()
    // 해설 앞의 ⚠ 같은 메모가 정답 줄 뒤에 있으면 해설에 포함
    const noteLines = (em[0] ?? '')
      .split('\n')
      .filter((l) => /^\s*(⚠|※)/.test(l))
    if (noteLines.length) explanation = [...noteLines, explanation].join('\n')
    explanation = explanation.replace(/\n{3,}/g, '\n\n').replace(/^---\s*$/gm, '').trim()
    const stem = pre.length ? `${b.stem}\n\n${pre.join('\n')}` : b.stem
    out.push({ id: b.id, q: stem, choices, answer, explanation, topic: '책 예상문제' })
  }
  return out
}

let total = 0
for (const part of fs.readdirSync(repoRoot).filter((n) => /^파트\d/.test(n))) {
  const dir = path.join(repoRoot, part)
  if (!fs.statSync(dir).isDirectory()) continue
  for (const sub of fs.readdirSync(dir).filter((n) => /예상문제/.test(n))) {
    const md = path.join(dir, sub, '문제.md')
    if (!fs.existsSync(md)) continue
    const qs = parse(fs.readFileSync(md, 'utf8'))
    const pn = part.match(/^파트(\d+)/)[1]
    const outFile = path.join(dir, sub, '퀴즈.json')
    fs.writeFileSync(outFile, JSON.stringify({ title: `PART ${pn} 적중 예상문제`, questions: qs }, null, 2))
    const bad = qs.filter((q) => q.choices.length < 4 || q.answer < 0 || q.answer >= q.choices.length || !q.explanation)
    console.log(`${part}: ${qs.length}문항 → 퀴즈.json${bad.length ? `  ⚠ 확인 필요: ${bad.map((q) => 'Q' + q.id).join(',')}` : ''}`)
    total += qs.length
  }
}
console.log('total', total)
