// 콘텐츠 로더. 폴더 구조:
//   파트N 제목/챕터M 제목/필기.md          ← 책 필기 (메인)
//   파트N 제목/챕터M 제목/자료/NN 이름.md   ← 참고자료 (CPPG 공식자료, KISA 안내서 등)
//   파트N 제목/챕터M 제목/퀴즈.json         ← 필기 기반 연습문제
//   파트N 제목/적중 예상문제/*.md           ← 책 수록 예상문제 풀이

const noteFiles = import.meta.glob('../../파트*/챕터*/*.md', { query: '?raw', import: 'default', eager: true })
const refFiles = import.meta.glob('../../파트*/챕터*/자료/*.md', { query: '?raw', import: 'default', eager: true })
const quizFiles = import.meta.glob('../../파트*/챕터*/퀴즈.json', { import: 'default', eager: true })
const bookQuizFiles = import.meta.glob('../../파트*/적중*/*.md', { query: '?raw', import: 'default', eager: true })

// 책 전체 목차 (파트·챕터 제목의 기준)
export const BOOK_TOC = [
  { num: 1, title: '개인정보 보호의 이해', chapters: ['개인정보의 개요', '개인정보 보호의 중요성', '기업의 사회적 책임', 'EU-GDPR'] },
  { num: 2, title: '개인정보 보호 제도', chapters: ['개인정보 보호 관련 법률', '개인정보 보호 원칙과 의무', '정보 주체의 권리', '분쟁해결절차'] },
  { num: 3, title: '개인정보 라이프 사이클 관리', chapters: ['개인정보의 수집과 이용', '개인정보 관리', '개인정보 제공'] },
  { num: 4, title: '개인정보의 보호조치', chapters: ['개인정보의 안전성 확보조치 기준의 개요', '개인정보의 안전성 확보조치 기준'] },
  { num: 5, title: '개인정보 관리체계', chapters: ['개인정보 관리체계 개요', '국외 주요 개인정보 인증제도', '국내 주요 개인정보 인증제도'] },
  { num: 6, title: '실전모의고사', chapters: ['실전모의고사 1회', '실전모의고사 2회', '실전모의고사 3회'], exam: true },
]

// 실제 CPPG 시험의 파트별 문항 수 (총 100문항, 120분)
export const EXAM_DISTRIBUTION = { 1: 10, 2: 20, 3: 25, 4: 30, 5: 15 }

function parseLabel(name) {
  const m = name.match(/^(파트|챕터)(\d+)\s*(.*)$/)
  return m ? { num: Number(m[2]), title: m[3].trim() } : null
}

function segsOf(path) {
  return path.split('/')
}

const chapterMap = new Map() // key "p1c1"

function getChapter(partName, chapterName) {
  const part = parseLabel(partName)
  const ch = parseLabel(chapterName)
  if (!part || !ch) return null
  const id = `p${part.num}c${ch.num}`
  if (!chapterMap.has(id)) {
    chapterMap.set(id, {
      id,
      partNum: part.num,
      partTitle: part.title,
      num: ch.num,
      title: ch.title,
      notes: null,
      refs: [],
      practice: null,
    })
  }
  return chapterMap.get(id)
}

for (const [path, content] of Object.entries(noteFiles)) {
  const s = segsOf(path)
  const ch = getChapter(s[s.length - 3], s[s.length - 2])
  if (ch) ch.notes = content
}

for (const [path, content] of Object.entries(refFiles).sort(([a], [b]) => a.localeCompare(b))) {
  const s = segsOf(path)
  const ch = getChapter(s[s.length - 4], s[s.length - 3])
  if (!ch) continue
  const file = s[s.length - 1].replace(/\.md$/, '')
  const label = file.replace(/^\d+\s*/, '')
  ch.refs.push({ key: file, label, content })
}

for (const [path, data] of Object.entries(quizFiles)) {
  const s = segsOf(path)
  const ch = getChapter(s[s.length - 3], s[s.length - 2])
  if (ch && data?.questions?.length) ch.practice = data
}

const bookQuizByPart = new Map()
for (const [path, content] of Object.entries(bookQuizFiles)) {
  const s = segsOf(path)
  const part = parseLabel(s[s.length - 3])
  if (part) bookQuizByPart.set(part.num, content)
}

export const chapters = [...chapterMap.values()].sort((a, b) => a.partNum - b.partNum || a.num - b.num)

export const parts = BOOK_TOC.map((p) => ({
  ...p,
  chapterList: p.chapters.map((title, i) => {
    const id = `p${p.num}c${i + 1}`
    const ch = chapterMap.get(id)
    return ch ?? { id, partNum: p.num, partTitle: p.title, num: i + 1, title, notes: null, refs: [], practice: null, empty: true }
  }),
  bookQuiz: bookQuizByPart.get(p.num) ?? null,
}))

export function findChapter(id) {
  return chapterMap.get(id) ?? null
}

export function findBookQuiz(partNum) {
  return bookQuizByPart.get(partNum) ?? null
}

// 모의고사용 전체 문제 풀
export const practicePool = chapters.flatMap((c) =>
  (c.practice?.questions ?? []).map((q) => ({
    ...q,
    uid: `${c.id}-${q.id}`,
    chapterId: c.id,
    chapterTitle: c.title,
    partNum: c.partNum,
    partTitle: c.partTitle,
  })),
)

export const stats = {
  notes: chapters.filter((c) => c.notes).length,
  refs: chapters.reduce((n, c) => n + c.refs.length, 0),
  questions: practicePool.length,
}
