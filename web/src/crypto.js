// content.enc 복호화 (브라우저 WebCrypto). 포맷은 scripts/encrypt.mjs 참조.
const KEY_STORE = 'cppg_key'

const b64 = {
  dec: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
  enc: (u8) => btoa(String.fromCharCode(...u8)),
}

let blobPromise = null
export function fetchBlob() {
  if (!blobPromise) {
    blobPromise = fetch(`${import.meta.env.BASE_URL}content.enc`, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`content.enc ${r.status}`)
      return r.json()
    })
    blobPromise.catch(() => {
      blobPromise = null
    })
  }
  return blobPromise
}

export async function deriveKey(password, blob) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64.dec(blob.salt), iterations: blob.iter },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt'],
  )
}

async function gunzip(u8) {
  if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 압축 해제를 지원하지 않습니다')
  const ds = new DecompressionStream('gzip')
  const stream = new Blob([u8]).stream().pipeThrough(ds)
  return new Response(stream).text()
}

export async function decryptBlob(key, blob) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(blob.iv) }, key, b64.dec(blob.data))
  const text = blob.gzip ? await gunzip(new Uint8Array(plain)) : new TextDecoder().decode(plain)
  return JSON.parse(text)
}

export async function rememberKey(key) {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  const s = b64.enc(raw)
  try {
    localStorage.setItem(KEY_STORE, s)
  } catch {
    // 저장 불가 환경
  }
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${KEY_STORE}=${encodeURIComponent(s)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`
  } catch {
    // 쿠키 불가 환경
  }
}

export async function rememberedKey() {
  let s = null
  try {
    s = localStorage.getItem(KEY_STORE)
  } catch {
    // ignore
  }
  if (!s) {
    try {
      const m = document.cookie.match(/(?:^|; )cppg_key=([^;]*)/)
      s = m ? decodeURIComponent(m[1]) : null
    } catch {
      // ignore
    }
  }
  if (!s) return null
  try {
    return await crypto.subtle.importKey('raw', b64.dec(s), { name: 'AES-GCM' }, true, ['decrypt'])
  } catch {
    return null
  }
}

export function forgetKey() {
  try {
    localStorage.removeItem(KEY_STORE)
  } catch {
    // ignore
  }
  try {
    document.cookie = `${KEY_STORE}=; Max-Age=0; Path=/`
  } catch {
    // ignore
  }
}
