// 필기 안 <figure class="diagram"> SVG를 PNG로 렌더링해 글자 넘침·겹침을 눈으로 확인하는 도구.
// 사용: node scripts/render-svg.mjs 입력.html 출력.png [입력2.html 출력2.png ...]
//   - 입력.html 에는 figure 블록(또는 <svg>…</svg>)만 담으면 된다.
//   - CSS 변수(var(--ink) 등)는 라이트 테마 값으로 치환해 그린다.
import fs from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const vars = {
  '--surface': '#ffffff',
  '--surface-2': '#eceef2',
  '--ink': '#1f4e9c',
  '--ink-soft': '#e6eefb',
  '--ok': '#1e8e5a',
  '--ok-soft': '#e4f3eb',
  '--no': '#d33f49',
  '--no-soft': '#fbe6e8',
  '--text': '#1a1f27',
  '--muted': '#5f6b7a',
  '--border': '#dde1e7',
}

const args = process.argv.slice(2)
if (args.length < 2 || args.length % 2) {
  console.error('usage: node scripts/render-svg.mjs in.html out.png [in2.html out2.png ...]')
  process.exit(1)
}
for (let i = 0; i < args.length; i += 2) {
  const [inp, out] = [args[i], args[i + 1]]
  const html = fs.readFileSync(inp, 'utf8')
  let svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>') + 6)
  svg = svg.replace(/var\((--[a-z0-9-]+)\)/g, (_, v) => vars[v] ?? '#000')
  svg = svg.replace('<svg ', '<svg style="color:#1a1f27;font-family:Malgun Gothic" ')
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: 900 },
    background: '#ffffff',
    font: { loadSystemFonts: true, defaultFontFamily: 'Malgun Gothic' },
  })
  fs.writeFileSync(out, r.render().asPng())
  console.log('wrote', out)
}
