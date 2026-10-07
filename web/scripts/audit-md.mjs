// 모든 필기/자료 md를 훑어 렌더링이 깨질 수 있는 마크다운 패턴을 보고한다.
import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2]
const files = []
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) {
      if (e.name === 'web' || e.name === '.git' || e.name === '자료' && !d.includes('챕터') ) continue
      if (e.name === '원본') continue
      walk(p)
    } else if (e.name.endsWith('.md') && /파트\d/.test(p)) files.push(p)
  }
}
walk(root)

const fixMd = (md) => md.replace(/\*\*\s*([^*\n]+?)\s*\*\*/g, '<strong>$1</strong>')

const report = { files: files.length, brokenBefore: 0, leftoverAfter: 0, oddLines: [], codeStar: [], singleStar: [], leftover: [] }
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const rel = path.relative(root, f)
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    const n = (line.match(/\*\*/g) || []).length
    if (n % 2 === 1) report.oddLines.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`)
    if (/`[^`]*\*\*[^`]*`/.test(line)) report.codeStar.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`)
    // 단일 * 강조가 한글 뒤에 바로 붙는 경우 (볼드 제거 후 검사)
    const noBold = line.replace(/\*\*[^*\n]+?\*\*/g, '')
    const m = noBold.match(/(^|[^*])\*[^*\s][^*\n]*?[^*\s]\*[가-힣A-Za-z0-9]/)
    if (m) report.singleStar.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`)
  })
  report.brokenBefore += (src.match(/\*\*[^*\n]+\*\*[가-힣A-Za-z0-9]/g) || []).length
  const after = fixMd(src)
  const left = after.split('\n').map((l, i) => [l, i]).filter(([l]) => l.includes('**'))
  report.leftoverAfter += left.length
  for (const [l, i] of left.slice(0, 50)) report.leftover.push(`${rel}:${i + 1}: ${l.trim().slice(0, 100)}`)
}
console.log(`files: ${report.files}`)
console.log(`broken-bold occurrences before fix: ${report.brokenBefore}`)
console.log(`lines still containing ** after fix: ${report.leftoverAfter}`)
console.log(`odd ** count lines: ${report.oddLines.length}`)
console.log(`** inside code span: ${report.codeStar.length}`)
console.log(`single * emphasis followed by letter: ${report.singleStar.length}`)
console.log('\n--- leftover after fix (first 50):')
console.log(report.leftover.join('\n'))
console.log('\n--- odd lines (first 30):')
console.log(report.oddLines.slice(0, 30).join('\n'))
console.log('\n--- code-span ** (first 10):')
console.log(report.codeStar.slice(0, 10).join('\n'))
console.log('\n--- single-star (first 10):')
console.log(report.singleStar.slice(0, 10).join('\n'))
