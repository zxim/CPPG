import { useEffect, useState } from 'react'
import { fetchBlob, deriveKey, decryptBlob, rememberKey } from './crypto'

/**
 * 비밀번호 게이트. 비밀번호로 키를 유도해 content.enc 를 복호화한다.
 * 복호화가 되면 그 자체가 인증이며, 유도된 키만 브라우저에 남겨 다음부터 자동으로 연다.
 */
export default function Gate({ onUnlock }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchBlob().catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const blob = await fetchBlob()
      const key = await deriveKey(pw, blob)
      const payload = await decryptBlob(key, blob)
      await rememberKey(key)
      onUnlock(payload)
    } catch (err) {
      const msg = String(err?.message || err)
      if (/content\.enc/.test(msg)) setError('암호화된 콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도하세요.')
      else if (/압축/.test(msg)) setError(msg)
      else setError('비밀번호가 틀렸습니다.')
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
        {error && (
          <p className="gate-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn gate-btn" disabled={busy || pw.length === 0}>
          {busy ? '복호화 중…' : '들어가기'}
        </button>
      </form>
    </div>
  )
}
