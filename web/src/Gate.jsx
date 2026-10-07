import { useEffect, useState } from 'react'
import { fetchBlob, deriveKey, decryptBlob, rememberKey } from './crypto'

/**
 * 비밀번호 게이트. 비밀번호로 키를 유도해 content.enc 를 복호화한다.
 * 복호화가 되면 그 자체가 인증이며, 유도된 키만 브라우저에 남겨 다음부터 자동으로 연다.
 */
// 연속 실패 시 대기: 3회까지는 바로, 이후 10초 → 20 → 40 … 최대 10분 (기기 로컬 기준)
const FAIL_KEY = 'cppg_fail'
const FREE_TRIES = 3
const BASE_WAIT = 10_000
const MAX_WAIT = 10 * 60_000

function readFail() {
  try {
    return JSON.parse(localStorage.getItem(FAIL_KEY) || '{"n":0,"until":0}')
  } catch {
    return { n: 0, until: 0 }
  }
}

function writeFail(v) {
  try {
    localStorage.setItem(FAIL_KEY, JSON.stringify(v))
  } catch {
    // ignore
  }
}

export default function Gate({ onUnlock }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fail, setFail] = useState(readFail)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    fetchBlob().catch(() => {})
  }, [])

  const waitLeft = Math.max(0, fail.until - now)
  useEffect(() => {
    if (waitLeft <= 0) return undefined
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [waitLeft > 0])

  const submit = async (e) => {
    e.preventDefault()
    if (waitLeft > 0) return
    setBusy(true)
    setError('')
    try {
      const blob = await fetchBlob()
      const key = await deriveKey(pw, blob)
      const payload = await decryptBlob(key, blob)
      await rememberKey(key)
      writeFail({ n: 0, until: 0 })
      onUnlock(payload)
    } catch (err) {
      const msg = String(err?.message || err)
      if (/content\.enc/.test(msg)) setError('암호화된 콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도하세요.')
      else if (/압축/.test(msg)) setError(msg)
      else {
        const n = fail.n + 1
        const over = n - FREE_TRIES
        const wait = over > 0 ? Math.min(MAX_WAIT, BASE_WAIT * 2 ** (over - 1)) : 0
        const next = { n, until: wait ? Date.now() + wait : 0 }
        setFail(next)
        writeFail(next)
        setNow(Date.now())
        setError(wait ? `비밀번호가 틀렸습니다. ${Math.round(wait / 1000)}초 후 다시 시도할 수 있습니다.` : '비밀번호가 틀렸습니다.')
      }
      setPw('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
        <div className="gate-brand">CPPG 필기노트</div>
        <p className="muted small">개인 학습용 비공개 페이지입니다. 비밀번호를 입력하면 이 기기에서 내용이 복호화됩니다.</p>
        <label htmlFor="gate-pw" className="gate-label">
          비밀번호
        </label>
        <input
          id="gate-pw"
          name="password"
          type="password"
          autoComplete="current-password"
          autoCapitalize="off"
          spellCheck={false}
          value={pw}
          onChange={(e) => {
            setPw(e.target.value)
            setError('')
          }}
          className="gate-input"
          autoFocus
        />
        {error && waitLeft <= 0 && (
          <p className="gate-error" role="alert">
            {error}
          </p>
        )}
        {waitLeft > 0 && (
          <p className="gate-error" role="alert">
            연속으로 틀려서 잠시 잠겼습니다. {Math.ceil(waitLeft / 1000)}초 후 다시 시도하세요.
          </p>
        )}
        <button type="submit" className="btn gate-btn" disabled={busy || pw.length === 0 || waitLeft > 0}>
          {busy ? '복호화 중…' : waitLeft > 0 ? `대기 중 (${Math.ceil(waitLeft / 1000)}초)` : '들어가기'}
        </button>
      </form>
    </div>
  )
}
