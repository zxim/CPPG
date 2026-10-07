// 복호화된 파일 목록 [{ path, content }] 을 파트/챕터 구조로 조립한다.
// 경로 규칙:
//   파트N 제목/챕터M 제목/필기.md           ← 책 필기 (메인)
//   파트N 제목/챕터M 제목/자료/NN 이름.md    ← 참고자료
//   파트N 제목/챕터M 제목/퀴즈.json          ← 필기 기반 연습문제
//   파트N 제목/적중 예상문제/*.md            ← 책 수록 예상문제 풀이
import { createContext, useContext } from 'react'

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

export function buildIndex(entries) {
  const chapterMap = new Map()
  const bookQuizByPart = new Map()

  const getChapter = (partName, chapterName) => {
    const part = parseLabel(partName)
    const ch = parseLabel(chapterName)
    if (!part || !ch) return null
    const id = `p${part.num}c${ch.num}`
    if (!chapterMap.has(id)) {
      chapterMap.set(id, { id, partNum: part.num, partTitle: part.title, num: ch.num, title: ch.title, notes: null, refs: [], practice: null })
    }
    return chapterMap.get(id)
  }

  for (const { path, content } of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    const s = path.split('/')
    if (s.length === 3 && s[2].endsWith('.md') && /^챕터/.test(s[1])) {
      const ch = getChapter(s[0], s[1])
      if (ch) ch.notes = content
    } else if (s.length === 3 && s[2] === '퀴즈.json' && /^챕터/.test(s[1])) {
      const ch = getChapter(s[0], s[1])
      let data = null
      try {
        data = JSON.parse(content)
      } catch {
        data = null
      }
      if (ch && data?.questions?.length) ch.practice = data
    } else if (s.length === 4 && s[2] === '자료' && s[3].endsWith('.md')) {
      const ch = getChapter(s[0], s[1])
      if (!ch) continue
      const file = s[3].replace(/\.md$/, '')
      ch.refs.push({ key: file, label: file.replace(/^\d+\s*/, ''), content })
    } else if (s.length === 3 && /예상문제/.test(s[1])) {
      const part = parseLabel(s[0])
      if (!part) continue
      const entry = bookQuizByPart.get(part.num) ?? { content: null, practice: null }
      if (s[2].endsWith('.md')) entry.content = content
      else if (s[2] === '퀴즈.json') {
        try {
          const data = JSON.parse(content)
          if (data?.questions?.length) entry.practice = data
        } catch {
          // 무시
        }
      }
      bookQuizByPart.set(part.num, entry)
    }
  }

  const chapters = [...chapterMap.values()].sort((a, b) => a.partNum - b.partNum || a.num - b.num)

  const parts = BOOK_TOC.map((p) => ({
    ...p,
    chapterList: p.chapters.map((title, i) => {
      const id = `p${p.num}c${i + 1}`
      return chapterMap.get(id) ?? { id, partNum: p.num, partTitle: p.title, num: i + 1, title, notes: null, refs: [], practice: null, empty: true }
    }),
    bookQuiz: bookQuizByPart.get(p.num) ?? null,
  }))

  const practicePool = chapters.flatMap((c) =>
    (c.practice?.questions ?? []).map((q) => ({
      ...q,
      uid: `${c.id}-${q.id}`,
      chapterId: c.id,
      chapterTitle: c.title,
      partNum: c.partNum,
      partTitle: c.partTitle,
    })),
  )

  return {
    parts,
    chapters,
    practicePool,
    findChapter: (id) => chapterMap.get(id) ?? null,
    findBookQuiz: (n) => bookQuizByPart.get(n) ?? null,
    stats: {
      notes: chapters.filter((c) => c.notes).length,
      refs: chapters.reduce((n, c) => n + c.refs.length, 0),
      questions: practicePool.length,
    },
  }
}

export const ContentContext = createContext(null)
export const useContent = () => useContext(ContentContext)
