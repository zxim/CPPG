import fs from 'node:fs'
const [md, breach, transfer] = process.argv.slice(2)
let s = fs.readFileSync(md, 'utf8')
// 기존 다이어그램 제거 후 다시 삽입
s = s.replace(/\n<figure class="diagram">[\s\S]*?<\/figure>\n/g, '')
const figB = fs.readFileSync(breach, 'utf8').trim()
const figT = fs.readFileSync(transfer, 'utf8').trim()
function insertAfter(src, heading, fig) {
  const i = src.indexOf(heading)
  if (i < 0) throw new Error('heading not found: ' + heading)
  const eol = src.indexOf('\n', i)
  return src.slice(0, eol + 1) + '\n' + fig + '\n' + src.slice(eol + 1)
}
s = insertAfter(s, '#### ⑤ 역외 이전 흐름도 (요약)', figT)
s = insertAfter(s, '#### ③ 침해 통지 흐름도 (요약)', figB)
fs.writeFileSync(md, s)
console.log('figures:', (s.match(/<figure class="diagram">/g) || []).length)
