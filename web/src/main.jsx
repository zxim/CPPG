import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Gate from './Gate.jsx'
import { buildIndex, ContentContext } from './content'
import { fetchBlob, decryptBlob, rememberedKey, forgetKey } from './crypto'

function Root() {
  const [state, setState] = useState({ phase: 'checking', content: null })

  // 저장된 키가 있으면 묻지 않고 복호화 시도
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const key = await rememberedKey()
        if (!key) throw new Error('no key')
        const blob = await fetchBlob()
        const payload = await decryptBlob(key, blob)
        if (alive) setState({ phase: 'ready', content: buildIndex(payload.entries) })
      } catch {
        forgetKey()
        if (alive) setState({ phase: 'locked', content: null })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (state.phase === 'checking') {
    return (
      <div className="gate">
        <div className="muted">불러오는 중…</div>
      </div>
    )
  }
  if (state.phase === 'locked') {
    return <Gate onUnlock={(payload) => setState({ phase: 'ready', content: buildIndex(payload.entries) })} />
  }
  return (
    <ContentContext.Provider value={state.content}>
      <App />
    </ContentContext.Provider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
