import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' → GitHub Pages 하위 경로, Vercel 루트 둘 다에서 동작
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // 필기 .md 파일이 web/ 바깥(각 챕터 폴더)에 있으므로 상위 폴더 접근 허용
    fs: { allow: ['..'] },
  },
})
