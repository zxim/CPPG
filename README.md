# CPPG 필기노트

CPPG(개인정보관리사) 시험 준비용 개인 필기와 연습문제를 폰에서 보기 위한 사이트.

- 사이트: https://zxim.github.io/CPPG/ (비밀번호 필요)
- 필기 원문은 저장소에 없고, 암호화된 `web/public/content.enc`만 올라간다. 비밀번호를 입력하면 브라우저에서 복호화된다.
- `web/`은 React(Vite) 뷰어. main에 push하면 GitHub Pages로 자동 배포.

```bash
cd web
npm install
npm run content   # 필기를 다시 암호화 (web/.env.local 필요)
npm run dev
```
