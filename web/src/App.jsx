import { useEffect, useState } from 'react'
import { useContent } from './content'
import Md from './Md'
import Quiz from './Quiz'
import Exam from './Exam'

function readHash() {
  return decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
}

function useHashRoute() {
  const [route, setRoute] = useState(readHash)
  useEffect(() => {
    const onChange = () => setRoute(readHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved) return saved
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta && bg) meta.setAttribute('content', bg)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // 저장 불가 환경이면 무시
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

/* ---------- 홈 ---------- */
function Home() {
  const { parts, stats } = useContent()
  return (
    <div className="home">
      <h1>CPPG 필기노트</h1>
      <p className="muted">
        필기 {stats.notes}챕터 · 참고자료 {stats.refs}건 · 연습문제 {stats.questions}문항
      </p>
      {parts.map((p) => (
        <section key={p.num} className="part">
          <h2>
            <span className="badge">PART {p.num}</span> {p.title}
          </h2>
          <ul>
            {p.exam && (
              <li className="quiz">
                <a href="#/exam">
                  <span className="chnum">모의</span>
                  <span className="grow">실전 모의고사 (연습문제 풀 무작위 출제)</span>
                </a>
              </li>
            )}
            {p.chapterList.map((c) => (
              <li key={c.id} className={c.empty ? 'todo' : ''}>
                {c.empty ? (
                  <span>
                    <span className="chnum">CH {String(c.num).padStart(2, '0')}</span> {c.title}
                  </span>
                ) : (
                  <a href={`#/${c.id}`}>
                    <span className="chnum">CH {String(c.num).padStart(2, '0')}</span>
                    <span className="grow">{c.title}</span>
                    <span className="marks">
                      {c.notes && <span className="mark notes">필기</span>}
                      {c.refs.length > 0 && <span className="mark ref">자료 {c.refs.length}</span>}
                      {c.practice && <span className="mark quiz">문제 {c.practice.questions.length}</span>}
                    </span>
                  </a>
                )}
              </li>
            ))}
            {p.bookQuiz && (
              <li className="quiz">
                <a href={`#/p${p.num}q`}>
                  <span className="chnum">문제</span>
                  <span className="grow">적중 예상문제 (책)</span>
                </a>
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  )
}

/* ---------- 챕터 ---------- */
function Chapter({ chapter, tab, sub }) {
  const { chapters } = useContent()
  const idx = chapters.findIndex((c) => c.id === chapter.id)
  const prev = chapters[idx - 1]
  const next = chapters[idx + 1]
  const hasNotes = !!chapter.notes
  const hasRefs = chapter.refs.length > 0
  const hasQuiz = !!chapter.practice
  const active = tab === 'ref' && hasRefs ? 'ref' : tab === 'quiz' && hasQuiz ? 'quiz' : hasNotes ? 'notes' : hasRefs ? 'ref' : 'quiz'
  const refIndex = Math.min(Math.max(0, Number(sub ?? 1) - 1), chapter.refs.length - 1)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [chapter.id, active, refIndex])

  return (
    <article className="chapter">
      <p className="crumb">
        <a href="#/">홈</a> › PART {chapter.partNum} {chapter.partTitle}
      </p>
      <div className="tabs">
        <a href={`#/${chapter.id}`} className={`${active === 'notes' ? 'on' : ''} ${hasNotes ? '' : 'disabled'}`}>
          필기
        </a>
        {hasRefs && (
          <a href={`#/${chapter.id}/ref`} className={active === 'ref' ? 'on' : ''}>
            참고자료 {chapter.refs.length}
          </a>
        )}
        {hasQuiz && (
          <a href={`#/${chapter.id}/quiz`} className={active === 'quiz' ? 'on' : ''}>
            연습문제 {chapter.practice.questions.length}
          </a>
        )}
      </div>

      {active === 'notes' && (
        <>
          <Md>{chapter.notes}</Md>
          {hasRefs && (
            <aside className="more">
              <div className="more-title">더 알아보기</div>
              <p className="muted small">이 챕터와 관련된 공식 자료 정리입니다. 책 내용이 메인이고, 아래는 보충용입니다.</p>
              <ul>
                {chapter.refs.map((r, i) => (
                  <li key={r.key}>
                    <a href={`#/${chapter.id}/ref/${i + 1}`}>{r.label}</a>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </>
      )}

      {active === 'ref' && (
        <>
          {!hasNotes && <p className="notice">이 챕터의 책 필기는 아직 없습니다(사진 대기). 아래는 공식 자료 정리입니다.</p>}
          {chapter.refs.length > 1 && (
            <div className="seg">
              {chapter.refs.map((r, i) => (
                <a key={r.key} href={`#/${chapter.id}/ref/${i + 1}`} className={i === refIndex ? 'on' : ''}>
                  {r.label}
                </a>
              ))}
            </div>
          )}
          <Md>{chapter.refs[refIndex].content}</Md>
        </>
      )}

      {active === 'quiz' && <Quiz chapterId={chapter.id} data={chapter.practice} />}

      {active !== 'quiz' && (
        <nav className="pager">
          {prev ? <a href={`#/${prev.id}`}>‹ {prev.title}</a> : <span />}
          {next ? <a href={`#/${next.id}`}>{next.title} ›</a> : <span />}
        </nav>
      )}
    </article>
  )
}

function BookQuiz({ partNum, content }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [partNum])
  return (
    <article className="chapter">
      <p className="crumb">
        <a href="#/">홈</a> › PART {partNum}
      </p>
      <Md>{content}</Md>
    </article>
  )
}

/* ---------- 앱 ---------- */
export default function App() {
  const { parts, findChapter, findBookQuiz } = useContent()
  const route = useHashRoute()
  const [theme, toggleTheme] = useTheme()
  const [open, setOpen] = useState(false)
  const [routeId, tab, sub] = route.split('/')

  useEffect(() => {
    setOpen(false)
  }, [route])

  let page
  if (routeId === 'exam') page = <Exam />
  else if (/^p\d+q$/.test(routeId)) {
    const pn = Number(routeId.slice(1, -1))
    const content = findBookQuiz(pn)
    page = content ? <BookQuiz partNum={pn} content={content} /> : <Home />
  } else {
    const chapter = routeId ? findChapter(routeId) : null
    page = chapter ? <Chapter chapter={chapter} tab={tab} sub={sub} /> : <Home />
  }

  return (
    <div className="layout">
      <header className="topbar">
        <button type="button" className="iconbtn" onClick={() => setOpen((o) => !o)} aria-label="목차 열기">
          ☰
        </button>
        <a href="#/" className="brand">
          CPPG 필기노트
        </a>
        <button type="button" className="iconbtn" onClick={toggleTheme} aria-label="테마 전환">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <a href="#/" className={`side-home ${routeId === '' ? 'active' : ''}`}>
          홈
        </a>
        {parts.map((p) => (
          <div key={p.num} className="side-part">
            <div className="side-part-title">
              PART {p.num}. {p.title}
            </div>
            {p.exam && (
              <a href="#/exam" className={routeId === 'exam' ? 'active' : ''}>
                <span className="side-tag">모의</span>
                <span className="grow">실전 모의고사</span>
              </a>
            )}
            {p.chapterList.map((c) =>
              c.empty ? (
                <span key={c.id} className="side-empty">
                  <span className="side-num">{c.num}</span>
                  <span className="grow">{c.title}</span>
                </span>
              ) : (
                <a key={c.id} href={`#/${c.id}`} className={c.id === routeId ? 'active' : ''}>
                  <span className="side-num">{c.num}</span>
                  <span className="grow">{c.title}</span>
                </a>
              ),
            )}
            {p.bookQuiz && (
              <a href={`#/p${p.num}q`} className={routeId === `p${p.num}q` ? 'active' : ''}>
                <span className="side-tag">문제</span>
                <span className="grow">적중 예상문제</span>
              </a>
            )}
          </div>
        ))}
      </aside>

      <main className="content">{page}</main>
    </div>
  )
}
