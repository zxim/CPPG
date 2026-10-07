// content.enc 를 WebCrypto(Node 의 globalThis.crypto.subtle)로 복호화해 브라우저 경로와 동일하게 검증
import fs from 'node:fs'
import zlib from 'node:zlib'
const [file, pass] = process.argv.slice(2)
const blob = JSON.parse(fs.readFileSync(file, 'utf8'))
const b64 = (s) => Uint8Array.from(Buffer.from(s, 'base64'))
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(blob.salt), iterations: blob.iter }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt'])
const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.data))
const json = JSON.parse(zlib.gunzipSync(Buffer.from(plain)).toString('utf8'))
console.log('entries:', json.entries.length, '| md:', json.entries.filter((e) => e.path.endsWith('.md')).length, '| quiz:', json.entries.filter((e) => e.path.endsWith('.json')).length)
console.log('sample:', json.entries.slice(0, 3).map((e) => e.path).join(' | '))
try {
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) }, await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(blob.salt), iterations: blob.iter }, await crypto.subtle.importKey('raw', new TextEncoder().encode('wrong'), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, true, ['decrypt']), b64(blob.data))
  console.log('WRONG PASSWORD DECRYPTED — BUG')
} catch {
  console.log('wrong password rejected: ok')
}
