# CPPG 필기노트

CPPG(개인정보관리사) 수험서를 요약·재구성한 개인 필기와, 폰에서 보기 위한 React 뷰어.

## 폴더 구조

```
CPPG/
├── 파트1 개인정보 보호의 이해/
│   ├── 챕터1 개인정보의 개요/
│   │   ├── 필기.md        ← 필기본 (git에 올라감)
│   │   └── *.jpg          ← 책 사진 (.gitignore로 제외)
│   └── 챕터2 .../
├── 파트2 ... 파트6/
├── web/                   ← React(Vite) 뷰어
└── .github/workflows/deploy.yml  ← push 시 GitHub Pages 자동 배포
```

`web/src/notes.js`가 빌드 시 아래 파일들을 전부 읽어 목차를 만든다. 책 필기가 메인이고 나머지는 보충이다.

```
파트N 제목/챕터M 제목/필기.md           → 챕터의 "필기" 탭 (책 사진 기반, 메인)
파트N 제목/챕터M 제목/자료/NN 이름.md    → "참고자료" 탭 (CPPG 공식자료·KISA 안내서 정리, 문서별 선택)
파트N 제목/챕터M 제목/퀴즈.json          → "연습문제" 탭 (필기 기반 4지선다, 정오답 → 해설 보기)
파트N 제목/적중 예상문제/*.md            → 파트별 책 수록 예상문제 풀이
```

좌측 메뉴는 책 목차(파트 1~6) 그대로이며 아직 내용이 없는 챕터는 흐리게 표시된다.
`#/exam`의 실전 모의고사는 모든 챕터의 `퀴즈.json`을 풀로 삼아 실제 시험 배분(파트별 10·20·25·30·15)에 맞춰 무작위 출제한다.

### 자료 폴더

`자료/원본/`에는 KISA 법령·지침·고시 해설서(PDF)와 CPPG 홈페이지 공식 학습자료(HWP 5종: G·C·가이드·북·PP)와
그 텍스트 추출본이 있다. 외부 배포물이라 git에는 올리지 않고, 파트별 `참고자료/` 폴더에 정리본만 둔다.
HWP 텍스트 추출은 Python `pyhwp`의 `hwp5txt`, PDF는 `pypdf`를 썼다.

## 로컬 실행

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # web/dist 생성
```

## 콘텐츠 암호화와 접근 비밀번호

필기·자료·퀴즈 원문(`파트*/`)은 **git에 올리지 않는다**(.gitignore). 대신 로컬에서 전부 모아 gzip 압축 후
AES-256-GCM으로 암호화한 `web/public/content.enc` 하나만 커밋한다. 키는 비밀번호에서 PBKDF2-SHA256(20만 회)으로 유도한다.

- 사이트는 비밀번호를 입력받아 브라우저 안에서 `content.enc`를 복호화한다. 복호화 성공이 곧 인증이다.
- 맞히면 유도된 키만 이 기기(localStorage + 쿠키 1년)에 남겨 다음부터 묻지 않는다. 비밀번호 자체는 어디에도 저장하지 않는다.
- GitHub에는 암호문만 있으므로 저장소가 public이어도 필기 내용은 읽을 수 없다. 비밀번호가 약하면 오프라인 추측은 가능하다.

### 필기를 고친 뒤 반영하는 방법

```bash
cd web
npm run content   # 파트*/ 전체를 다시 암호화 → public/content.enc 갱신
git add public/content.enc && git commit -m "필기 갱신" && git push
```

`npm run dev`/`npm run build`는 소스 폴더와 `.env.local`이 있으면 자동으로 다시 암호화한다. GitHub Actions에는 소스가 없으므로 커밋된 `content.enc`를 그대로 쓴다.

### 비밀번호·솔트

`web/.env.local`(gitignore 대상)에 둔다. 비밀번호를 바꾸면 `npm run content`로 다시 암호화해 커밋하면 된다. 솔트는 처음 한 번 자동 생성되며 바꾸지 않아야 기존 기기의 저장 키가 계속 유효하다.

```
CPPG_PASS=<비밀번호>
CPPG_SALT=<자동 생성>
```

원문은 이 폴더(OneDrive 동기화)에만 있으므로 백업에 유의한다.

## 배포 (GitHub Pages)

1. GitHub 저장소 생성 후 `main` 브랜치로 push
2. 저장소 Settings → Pages → Source를 **GitHub Actions**로 선택
3. 이후 push마다 자동 배포. 주소: `https://<계정>.github.io/<저장소명>/`

Vercel로 바꾸려면 저장소 연결 후 Root Directory를 `web`으로 지정하면 된다 (base가 `./`라 그대로 동작).
