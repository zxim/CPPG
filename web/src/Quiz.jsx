import { useEffect, useMemo, useState } from 'react'
import { MdInline } from './Md'

export const CIRCLED = ['①', '②', '③', '④', '⑤']

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장 불가 환경이면 무시
  }
}

/**
 * 연습문제. 답을 고르면 정답/오답만 알려주고, "해설 보기"를 눌러야 정답 번호와 해설이 공개된다.
 * answers: { [id]: { c: 고른 번호, r: 해설 공개 여부 } }
 */
export default function Quiz({ chapterId, data }) {
  const storageKey = `quiz2:${chapterId}`
  const all = data.questions
  const [answers, setAnswers] = useState(() => loadJSON(storageKey, {}))
  const [order, setOrder] = useState(() => all.map((q) => q.id))
  const [mode, setMode] = useState('all')
  const [level, setLevel] = useState('all') // all | 하 | 중 | 상
  const [kind, setKind] = useState('all') // all | 기본 | 지문형 | 대화형 | 자료형 | 순서형
  const [current, setCurrent] = useState(0)

  useEffect(() => saveJSON(storageKey, answers), [storageKey, answers])

  const byId = useMemo(() => new Map(all.map((q) => [q.id, q])), [all])
  const hasLevels = useMemo(() => all.some((q) => q.difficulty), [all])
  const kinds = useMemo(() => {
    const set = new Set(all.map((q) => q.type).filter(Boolean))
    return set.size ? ['기본', ...set] : []
  }, [all])
  const visibleIds = useMemo(() => {
    let ids = order
    if (level !== 'all') ids = ids.filter((id) => byId.get(id).difficulty === level)
    if (kind !== 'all') ids = ids.filter((id) => (byId.get(id).type || '기본') === kind)
    if (mode === 'wrong') ids = ids.filter((id) => answers[id] && answers[id].c !== byId.get(id).answer)
    return ids
  }, [order, mode, level, kind, answers, byId])

  const answered = all.filter((q) => answers[q.id])
  const correctCount = answered.filter((q) => answers[q.id].c === q.answer).length
  const wrongCount = answered.length - correctCount

  useEffect(() => {
    if (current >= visibleIds.length) setCurrent(Math.max(0, visibleIds.length - 1))
  }, [visibleIds.length, current])

  const reset = () => {
    setAnswers({})
    setMode('all')
    setCurrent(0)
  }
  const reshuffle = () => {
    setOrder(shuffle(all.map((q) => q.id)))
    setCurrent(0)
  }
  const toolbar = (
    <QuizToolbar
      {...{ answeredCount: answered.length, correctCount, wrongCount, total: all.length, mode, setMode, reset, reshuffle }}
      level={level}
      setLevel={(l) => {
        setLevel(l)
        setCurrent(0)
      }}
      hasLevels={hasLevels}
      kind={kind}
      setKind={(k) => {
        setKind(k)
        setCurrent(0)
      }}
      kinds={kinds}
    />
  )

  if (visibleIds.length === 0) {
    return (
      <div className="quiz">
        {toolbar}
        <p className="quiz-empty">
          {mode === 'wrong' ? '틀린 문제가 없습니다. 전체 모드로 돌아가거나 초기화 후 다시 풀어보세요.' : '이 조건에 해당하는 문제가 없습니다.'}
        </p>
      </div>
    )
  }

  const q = byId.get(visibleIds[current])
  const a = answers[q.id]
  const pick = (idx) => {
    if (a) return
    setAnswers((prev) => ({ ...prev, [q.id]: { c: idx, r: false } }))
  }
  const reveal = () => setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], r: true } }))
  const retry = () =>
    setAnswers((prev) => {
      const next = { ...prev }
      delete next[q.id]
      return next
    })

  return (
    <div className="quiz">
      {toolbar}
      <QuestionCard
        q={q}
        index={current}
        total={visibleIds.length}
        chosen={a?.c}
        revealed={!!a?.r}
        onPick={pick}
        onReveal={reveal}
        onRetry={retry}
        showMeta
      />
      <nav className="quiz-nav" aria-label="문제 이동">
        <button type="button" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
          ‹ 이전
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => setCurrent((c) => Math.min(visibleIds.length - 1, c + 1))}
          disabled={current >= visibleIds.length - 1}
        >
          다음 ›
        </button>
      </nav>
      <div className="quiz-dots">
        {visibleIds.map((id, i) => {
          const an = answers[id]
          let cls = 'dot'
          if (an) cls += an.c === byId.get(id).answer ? ' ok' : ' no'
          if (i === current) cls += ' cur'
          return <button type="button" key={id} className={cls} onClick={() => setCurrent(i)} aria-label={`문제 ${i + 1}`} />
        })}
      </div>
    </div>
  )
}

/**
 * 문제 카드 (연습문제·모의고사 공용).
 * mode="exam"이면 피드백 없이 선택만 하고, 선택을 바꿀 수 있다.
 */
export function QuestionCard({ q, index, total, chosen, revealed, onPick, onReveal, onRetry, mode = 'practice', showMeta = false, number }) {
  const isExam = mode === 'exam'
  const picked = chosen !== undefined && chosen !== null
  const isCorrect = picked && chosen === q.answer
  return (
    <div className="quiz-card">
      <div className="quiz-meta">
        <span>
          {index + 1} / {total}
        </span>
        {showMeta && (
          <span className="quiz-tags">
            {q.type && <span className="tag type">{q.type}</span>}
            {q.topic && <span className="tag">{q.topic}</span>}
            {q.difficulty && <span className={`tag diff-${q.difficulty}`}>{q.difficulty}</span>}
          </span>
        )}
      </div>
      <p className="quiz-q">
        <span className="quiz-qnum">Q{number ?? q.id}.</span> <MdInline>{q.q}</MdInline>
      </p>
      <ul className="quiz-choices">
        {q.choices.map((c, i) => {
          let cls = 'choice'
          if (isExam) {
            if (i === chosen) cls += ' picked'
          } else if (revealed) {
            if (i === q.answer) cls += ' correct'
            else if (i === chosen) cls += ' wrong'
            else cls += ' dim'
          } else if (picked) {
            cls += i === chosen ? ' picked' : ' dim'
          }
          return (
            <li key={i}>
              <button type="button" className={cls} onClick={() => onPick(i)} disabled={!isExam && picked}>
                <span className="choice-num">{CIRCLED[i]}</span>
                <span className="choice-text">
                  <MdInline>{c}</MdInline>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {!isExam && picked && (
        <div className={`quiz-result ${isCorrect ? 'ok' : 'no'}`}>
          <div className="quiz-verdict">{isCorrect ? '정답입니다' : '오답입니다'}</div>
          {!revealed ? (
            <div className="quiz-result-actions">
              <button type="button" className="btn" onClick={onReveal}>
                해설 보기
              </button>
              {!isCorrect && onRetry && (
                <button type="button" className="btn ghost" onClick={onRetry}>
                  다시 풀기
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="quiz-answer">
                정답 <b>{CIRCLED[q.answer]}</b>
                {!isCorrect && (
                  <>
                    {' '}
                    · 내 답 <b>{CIRCLED[chosen]}</b>
                  </>
                )}
              </p>
              <div className="quiz-exp">
                <MdInline>{q.explanation}</MdInline>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function QuizToolbar({ answeredCount, correctCount, wrongCount, total, mode, setMode, reset, reshuffle, level, setLevel, hasLevels, kind, setKind, kinds }) {
  return (
    <div className="quiz-toolbar">
      <div className="quiz-score">
        <span>
          푼 문제 <b>{answeredCount}</b>/{total}
        </span>
        <span className="ok">정답 {correctCount}</span>
        <span className="no">오답 {wrongCount}</span>
      </div>
      {kinds.length > 0 && (
        <div className="quiz-actions quiz-levels" aria-label="문제 유형">
          <button type="button" className={kind === 'all' ? 'on' : ''} onClick={() => setKind('all')}>
            유형 전체
          </button>
          {kinds.map((k) => (
            <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
      )}
      {hasLevels && (
        <div className="quiz-actions quiz-levels" aria-label="난이도">
          {[
            ['all', '난이도 전체'],
            ['하', '하'],
            ['중', '중'],
            ['상', '상'],
          ].map(([v, label]) => (
            <button type="button" key={v} className={level === v ? 'on' : ''} onClick={() => setLevel(v)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="quiz-actions">
        <button type="button" className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>
          전체
        </button>
        <button type="button" className={mode === 'wrong' ? 'on' : ''} onClick={() => setMode('wrong')} disabled={wrongCount === 0}>
          틀린 것만
        </button>
        <button type="button" onClick={reshuffle}>
          섞기
        </button>
        <button type="button" onClick={reset}>
          초기화
        </button>
      </div>
    </div>
  )
}
