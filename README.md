# Blogville 🏘

> 글을 쓸수록 내 마을이 자라는 **게임형 블로그 서비스**

AI응용프로젝트 개인 프로젝트입니다. [Tistory](https://www.tistory.com/)의 블로그 기능을 기본으로, 캐릭터·광장·보상 같은 게임 요소를 더했습니다.

- 요구사항 명세서: [docs/01-requirements.md](docs/01-requirements.md)
- ERD(데이터베이스 설계): [docs/02-erd.md](docs/02-erd.md)
- 협업 가이드(브랜치·PR·리뷰 규칙): [CONTRIBUTING.md](CONTRIBUTING.md)

## 주요 기능

| 분류 | 기능 |
|---|---|
| 회원 | 아이디·비밀번호 회원가입/로그인, 네이버·카카오·구글 소셜 로그인, 온보딩(닉네임·블로그 주소·기본 캐릭터) |
| 관리자 | 통계, 회원 목록, 글 삭제 (`/admin`) |
| 광장 | Phaser 2D 마을. 방향키·WASD·클릭으로 이동, 건물에 들어가 기능 이용, 최근 글 쓴 이웃집 |
| 블로그 | `/@주소` 블로그 홈, 미니룸, 카테고리, 글쓰기 에디터(Tiptap), 공개/비공개, 태그 |
| 교류 | 공감, 댓글·답글, 이웃 추가, 마을 소식, 이웃 새 글, 태그별 글 |
| 게임 | 경험치·레벨, 코인, 출석(7일 연속 보너스), 활동 보상(하루 상한), 상점, 꾸미기 |

## 기술 스택

| 역할 | 기술 | 선택 이유 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router), TypeScript | 화면과 서버를 한 프로젝트·한 언어로. 혼자 개발하기 좋은 풀스택 구조 |
| DB | PostgreSQL | 회원·글·보상이 서로 연결된 관계형 데이터. FK·UNIQUE·CHECK로 규칙을 DB가 보장 |
| ORM | Drizzle | SQL과 거의 같은 문법이라 ERD → 코드 변환이 직관적, 마이그레이션이 SQL 파일로 남음 |
| 로그인 | Better Auth | 네이버·카카오·구글을 기본 지원하는 안정 버전, Drizzle 연동 |
| 스타일 | Tailwind CSS 4 | 빠른 화면 작업 |
| 에디터 | Tiptap 3 + sanitize-html | Tistory 같은 WYSIWYG 편집, 저장 시 HTML 정화로 XSS 방지 |
| 게임 화면 | Phaser 4 | 2D 이동·충돌·카메라, 같은 엔진으로 2.5D(아이소메트릭) 확장 가능 |
| 테스트 | Playwright | 실제 브라우저로 가입·글쓰기·보상·구매 흐름 검증 |

## 실행 방법

### 준비물

- Node.js 20.9 이상
- PostgreSQL (macOS: `brew install postgresql@17 && brew services start postgresql@17`)

### 설치

```bash
npm install
createdb blogville
cp .env.example .env.local      # DATABASE_URL, BETTER_AUTH_SECRET 채우기
npm run db:migrate              # 테이블 만들기
npm run db:seed                 # 캐릭터·배경 아이템 넣기
npm run admin:create            # 관리자 계정 만들기 (.env.local의 ADMIN_USERNAME / ADMIN_PASSWORD)
npm run dev                     # http://localhost:3000
```

첫 화면에서 **회원가입** 탭으로 아이디를 만들어 바로 쓸 수 있습니다. 관리자로 로그인하면 헤더에 **👑 관리자** 버튼이 생깁니다.

> 관리자 비밀번호는 코드가 아니라 `.env.local`(Git에 올리지 않는 파일)에 둡니다. 배포 전에는 반드시 길고 복잡한 비밀번호로 바꾸고 `npm run admin:create`를 다시 실행하세요.

### 소셜 로그인 설정

각 개발자 센터에서 앱을 만들고 `.env.local`에 키를 넣습니다. 키가 있는 서비스만 로그인 버튼이 켜집니다.

| 서비스 | 콘솔 | Redirect URI |
|---|---|---|
| 카카오 | developers.kakao.com | `http://localhost:3000/api/auth/callback/kakao` |
| 네이버 | developers.naver.com | `http://localhost:3000/api/auth/callback/naver` |
| 구글 | console.cloud.google.com | `http://localhost:3000/api/auth/callback/google` |

> 카카오는 개인 개발자 앱에서 이메일 동의항목을 쓰기 어려워 닉네임·프로필 사진만 요청하고, 이메일 자리에는 `kakao_<ID>@kakao.blogville.invalid` 대체 주소를 저장합니다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run db:generate` | `src/db/schema.ts` 변경 → 마이그레이션 SQL 생성 |
| `npm run db:migrate` | 마이그레이션 적용 |
| `npm run db:seed` | 아이템 카탈로그 넣기 (여러 번 실행해도 안전) |
| `npm run db:reset` | (로컬 전용) 회원·글 데이터 비우기 (관리자도 지워지므로 `admin:create` 다시 실행) |
| `npm run admin:create` | 관리자 계정 생성·비밀번호 갱신 (여러 번 실행해도 안전) |
| `npm run db:studio` | DB를 브라우저에서 보기 (Drizzle Studio) |
| `node e2e/auth.mjs <폴더>` | 회원가입·로그인·관리자 권한 E2E (개발 서버 실행 중) |
| `node e2e/blog.mjs <폴더>` | 글쓰기·공감·댓글·보상 E2E |
| `node e2e/game.mjs <폴더>` | 출석·상점·꾸미기 E2E |
| `node e2e/social.mjs <폴더>` | 이웃 추가·취소, 조작한 이웃 요청 거부 E2E (`e2e/blog.mjs` 다음에) |
| `node e2e/attendance-rank.mjs <폴더>` | 출석 1·2·3등 보너스(🪙 100) E2E (실행마다 새 회원 4명, 오늘 출석 수에 맞춰 기대값 계산) |
| `node e2e/nonfunctional.mjs <폴더> [주소]` | 모바일 가로 스크롤·응답 시간 측정 (속도는 프로덕션 빌드 대상) |
| `npm test` | 아래 두 테스트를 함께 실행 |
| `npm run test:game` | 레벨(최고 99)·연속 출석 계산 테스트 |
| `npm run test:sanitize` | 글 HTML 정화(XSS 방지) 테스트 |
| `node e2e/decisions.mjs <폴더>` | 팀 결정 구현 E2E: 3종 지급, 장착 표시, 연속 출석, 내역, 최고 레벨, 광장 이웃집, 조이스틱 |

## 폴더 구조

```
docs/                     요구사항 명세서, ERD
drizzle/                  마이그레이션 SQL (자동 생성)
scripts/                  시드, 개발 DB 초기화
e2e/                      Playwright 시나리오
src/
├── app/                  화면과 Server Action
│   ├── blog/[slug]/      블로그 홈, 글 상세  (주소는 /@slug 로 rewrite)
│   ├── town/             중앙 광장
│   ├── write/            글쓰기·수정
│   ├── attendance/ shop/ closet/ settings/blog/ feed/ tags/ onboarding/
│   └── api/auth/         소셜 로그인 엔드포인트
├── components/           화면 조각 (town/ = Phaser 씬, editor/ = Tiptap)
├── db/                   Drizzle 스키마, DB 연결
├── lib/                  게임 규칙(레벨·보상), 그림 정의, 로그인 설정
└── server/               DB 쿼리, 로그인 확인(DAL), 보상 지급, HTML 정화
```

## 설계 포인트

- **잔액을 저장하지 않는다**: 코인·경험치는 `point_ledger`(원장)의 합계로 계산하고, 레벨도 경험치로 계산한다.
- **규칙은 DB가 지킨다**: 출석은 `(user_id, date)` 기본 키로 하루 한 번, 공감은 `(post_id, user_id)`로 한 번, 장착은 복합 외래 키로 보유 아이템만.
- **동시성**: 보상·구매는 회원 단위 advisory lock을 건 트랜잭션에서 처리해 동시 클릭에도 한 번만 지급된다.
- **권한 검사는 서버에서**: 모든 Server Action이 로그인과 소유자를 다시 확인한다.
