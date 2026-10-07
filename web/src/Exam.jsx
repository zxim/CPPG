import { useEffect, useMemo, useState } from 'react'
import { EXAM_DISTRIBUTION, BOOK_TOC, useContent } from './content'
import { QuestionCard, CIRCLED, shuffle, loadJSON, saveJSON } from './Quiz'
import { MdInline } from './Md'

const KEY_CURRENT = 'exam:current'
const KEY_HISTORY = 'exam:history'
const SEC_PER_Q = 72 // 실제 시험 120분 / 100문항

const PRESETS = [
  { id: 'quick', label: '빠른 점검', count: 20, desc: '20문항 · 24분' },
  { id: 'half', label: '절반 모의', count: 50, desc: '50문항 · 60분' },
  { id: 'full', label: '실전 100문항', count: 100, desc: '100문항 · 120분 · 파트별 배분' },
]

/** 파트별 실제 배분 비율로 문제를 뽑되, 풀에 없는 파트의 몫은 있는 파트로 채운다. */
function draw(practicePool, count) {
  const byPart = new Map()
  for (const q of practicePool) {
    if (!byPart.has(q.partNum)) byPart.set(q.partNum, [])
    byPart.get(q.partNum).push(q)
  }
  for (const [k, v] of byPart) byPart.set(k, shuffle(v))

  const picked = []
  const totalWeight = Object.values(EXAM_DISTRIBUTION).reduce((a, b) => a + b, 0)
  const want = {}
  for (const [p, w] of Object.entries(EXAM_DISTRIBUTION)) want[p] = Math.round((count * w) / totalWeight)

  for (const [p, n] of Object.entries(want)) {
    const pool = byPart.get(Number(p)) ?? []
    picked.push(...pool.splice(0, n))
  }
  // 부족분 채우기
  const leftovers = shuffle([...byPart.values()].flat())
  while (picked.length < count && leftovers.length) picked.push(leftovers.shift())
  return shuffle(picked).slice(0, count)
}

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Exam() {
  const { practicePool } = useContent()
  const [session, setSession] = useState(() => loadJSON(KEY_CURRENT, null))
  const [history, setHistory] = useState(() => loadJSON(KEY_HISTORY, []))

  useEffect(() => saveJSON(KEY_CURRENT, session), [session])
  useEffect(() => saveJSON(KEY_HISTORY, history), [history])

  const start = (count) => {
    const qs = draw(practicePool, count)
    if (qs.length === 0) return
    setSession({
      startedAt: Date.now(),
      limitSec: qs.length * SEC_PER_Q,
      questions: qs,
      answers: {},
      current: 0,
      submitted: false,
    })
    window.scrollTo(0, 0)
  }

  const finish = (s) => {
    const result = grade(s)
    setHistory((h) => [{ at: Date.now(), ...result.summary }, ...h].slice(0, 20))
    setSession({ ...s, submitted: true, finishedAt: Date.now() })
    window.scrollTo(0, 0)
  }

  if (!session) return <ExamSetup onStart={start} history={history} practicePool={practicePool} />
  if (session.submitted) return <ExamResult session={session} onRestart={() => setSession(null)} />
  return <ExamRun session={session} setSession={setSession} onFinish={finish} />
}

function ExamSetup({ onStart, history, practicePool }) {
  const total = practicePool.length
  const byPart = BOOK_TOC.map((p) => ({ ...p, n: practicePool.filter((q) => q.partNum === p.num).length }))
  return (
    <div className="exam">
      <h1 className="page-title">실전 모의고사</h1>
      <p className="muted">
        연습문제 풀에서 무작위로 출제합니다. 실제 시험처럼 풀이 중에는 정답을 알려주지 않고, 제출 후 채점과 해설을 봅니다.
      </p>
      <div className="exam-pool">
        <div className="exam-pool-head">문제 풀 {total}문항</div>
        <ul>
          {byPart.map((p) => (
            <li key={p.num} className={p.n === 0 ? 'todo' : ''}>
              <span className="chnum">P{p.num}</span>
              <span className="grow">{p.title}</span>
              <span className="pill">{p.n}문항</span>
            </li>
          ))}
        </ul>
        <p className="muted small">실제 시험 배분은 파트1 10 · 파트2 20 · 파트3 25 · 파트4 30 · 파트5 15 (총 100문항, 120분). 아직 문제가 없는 파트의 몫은 있는 파트에서 채웁니다.</p>
      </div>
      <div className="exam-presets">
        {PRESETS.map((p) => (
          <button type="button" key={p.id} className="preset" onClick={() => onStart(p.count)} disabled={total === 0}>
            <span className="preset-label">{p.label}</span>
            <span className="preset-desc">{p.desc}</span>
          </button>
        ))}
      </div>
      {history.length > 0 && (
        <section className="exam-history">
          <h2>최근 기록</h2>
          <table>
            <thead>
              <tr>
                <th>일시</th>
                <th>문항</th>
                <th>점수</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>{new Date(h.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{h.total}</td>
                  <td>{h.score}점</td>
                  <td className={h.pass ? 'ok' : 'no'}>{h.pass ? '합격권' : '미달'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function ExamRun({ session, setSession, onFinish }) {
  const { questions, answers, current, startedAt, limitSec } = session
  const [now, setNow] = useState(Date.now())
  const [confirming, setConfirming] = useState(false)
  const [showGrid, setShowGrid] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsed = Math.floor((now - startedAt) / 1000)
  const remain = Math.max(0, limitSec - elapsed)
  useEffect(() => {
    if (remain === 0) onFinish(session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remain === 0])

  const q = questions[current]
  const answeredCount = Object.keys(answers).length
  const pick = (i) => setSession({ ...session, answers: { ...answers, [q.uid]: i } })
  const go = (i) => {
    setSession({ ...session, current: Math.min(questions.length - 1, Math.max(0, i)) })
    setShowGrid(false)
    window.scrollTo(0, 0)
  }

  return (
    <div className="exam">
      <div className="exam-bar">
        <span className={`exam-timer ${remain < 300 ? 'warn' : ''}`}>{fmt(remain)}</span>
        <span className="muted">
          답안 {answeredCount}/{questions.length}
        </span>
        <button type="button" className="btn ghost small" onClick={() => setShowGrid((v) => !v)}>
          {showGrid ? '닫기' : '문항표'}
        </button>
      </div>

      {showGrid && (
        <div className="exam-grid">
          {questions.map((qq, i) => (
            <button
              type="button"
              key={qq.uid}
              className={`cell ${answers[qq.uid] !== undefined ? 'done' : ''} ${i === current ? 'cur' : ''}`}
              onClick={() => go(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <QuestionCard q={q} index={current} total={questions.length} number={current + 1} chosen={answers[q.uid]} mode="exam" onPick={pick} />

      {confirming ? (
        <div className="exam-confirm">
          <p>
            {answeredCount < questions.length ? `아직 ${questions.length - answeredCount}문항을 풀지 않았습니다. ` : ''}
            지금 제출하고 채점할까요?
          </p>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>
              계속 풀기
            </button>
            <button type="button" className="btn" onClick={() => onFinish(session)}>
              제출
            </button>
          </div>
        </div>
      ) : null}

      <nav className="quiz-nav" aria-label="문제 이동">
        <button type="button" onClick={() => go(current - 1)} disabled={current === 0}>
          ‹ 이전
        </button>
        {current < questions.length - 1 ? (
          <button type="button" className="primary" onClick={() => go(current + 1)}>
            다음 ›
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => setConfirming(true)}>
            제출하기
          </button>
        )}
      </nav>
    </div>
  )
}

function grade(session) {
  const { questions, answers } = session
  const perPart = {}
  let correct = 0
  const wrong = []
  for (const q of questions) {
    const p = (perPart[q.partNum] ??= { total: 0, correct: 0 })
    p.total++
    if (answers[q.uid] === q.answer) {
      correct++
      p.correct++
    } else wrong.push(q)
  }
  const total = questions.length
  const score = Math.round((correct / total) * 100)
  // 실제 기준: 총점 60점 이상 + 과목별 40% 이상
  const partFail = Object.values(perPart).some((p) => p.correct / p.total < 0.4)
  const pass = score >= 60 && !partFail
  return { summary: { total, correct, score, pass }, perPart, wrong }
}

function ExamResult({ session, onRestart }) {
  const { questions, answers } = session
  const r = useMemo(() => grade(session), [session])
  const [filter, setFilter] = useState('wrong')
  const [open, setOpen] = useState({})
  const took = session.finishedAt ? Math.floor((session.finishedAt - session.startedAt) / 1000) : 0
  const list = filter === 'wrong' ? r.wrong : questions

  return (
    <div className="exam">
      <h1 className="page-title">채점 결과</h1>
      <div className={`exam-score ${r.summary.pass ? 'ok' : 'no'}`}>
        <div className="big">{r.summary.score}점</div>
        <div>
          {r.summary.correct} / {r.summary.total} 정답 · 소요 {fmt(took)}
        </div>
        <div className="verdict">{r.summary.pass ? '합격권 (60점 이상, 과목별 40% 이상)' : '합격 기준 미달'}</div>
      </div>
      <table className="exam-parts">
        <thead>
          <tr>
            <th>파트</th>
            <th>정답</th>
            <th>정답률</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(r.perPart).map(([p, v]) => {
            const rate = Math.round((v.correct / v.total) * 100)
            return (
              <tr key={p} className={rate < 40 ? 'no' : ''}>
                <td>PART {p}</td>
                <td>
                  {v.correct}/{v.total}
                </td>
                <td>{rate}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="row between">
        <div className="quiz-actions">
          <button type="button" className={filter === 'wrong' ? 'on' : ''} onClick={() => setFilter('wrong')}>
            틀린 문제 {r.wrong.length}
          </button>
          <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            전체
          </button>
        </div>
        <button type="button" className="btn" onClick={onRestart}>
          새 모의고사
        </button>
      </div>

      <ol className="review">
        {list.map((q) => {
          const mine = answers[q.uid]
          const ok = mine === q.answer
          const idx = questions.indexOf(q)
          return (
            <li key={q.uid} className={`review-item ${ok ? 'ok' : 'no'}`}>
              <div className="review-head">
                <span className="review-num">{idx + 1}</span>
                <span className="review-part">
                  P{q.partNum} · {q.chapterTitle}
                </span>
              </div>
              <p className="quiz-q">
                <MdInline>{q.q}</MdInline>
              </p>
              <ul className="review-choices">
                {q.choices.map((c, i) => (
                  <li key={i} className={i === q.answer ? 'correct' : i === mine ? 'wrong' : ''}>
                    <span className="choice-num">{CIRCLED[i]}</span>
                    <MdInline>{c}</MdInline>
                  </li>
                ))}
              </ul>
              <p className="quiz-answer">
                정답 <b>{CIRCLED[q.answer]}</b> · 내 답 <b>{mine === undefined ? '미응답' : CIRCLED[mine]}</b>
              </p>
              {open[q.uid] ? (
                <div className="quiz-exp">
                  <MdInline>{q.explanation}</MdInline>
                </div>
              ) : (
                <button type="button" className="btn ghost small" onClick={() => setOpen((o) => ({ ...o, [q.uid]: true }))}>
                  해설 보기
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
