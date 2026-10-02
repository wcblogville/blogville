@AGENTS.md

# Blogville 작업 안내

AI응용프로젝트 개인 프로젝트. 게임형 블로그(Next.js 16 + PostgreSQL + Drizzle + Better Auth + Phaser 4).
사용자는 한국어로 소통하는 학습 중인 개발자이므로, 무엇을 왜 하는지 짧게 설명하며 진행한다.

## 먼저 읽을 것

- `docs/01-requirements.md` 요구사항(ID: AUTH-01 등), `docs/02-erd.md` DB 설계와 결정 이유
- Next.js 16은 학습 데이터와 다르다: `params`/`searchParams`/`cookies()`는 await, `middleware` → `proxy`, `@` 폴더는 parallel route (블로그는 `/@slug` → `/blog/[slug]` rewrite)
- Phaser 4: `node_modules/phaser/skills/`, 마이그레이션 가이드 `node_modules/phaser/changelog/v4/4.0/MIGRATION-GUIDE.md`

## 규칙

- **스키마 변경**: `src/db/schema.ts` 수정 → `npm run db:generate` → `npm run db:migrate`. `docs/02-erd.md`도 함께 고친다.
- **인증**: 페이지와 Server Action마다 `requireMember()` / `requireUser()` (`src/server/dal.ts`). 레이아웃에서 권한 검사를 하지 않는다.
- **보상·코인**: 잔액 컬럼을 만들지 않는다. `point_ledger`에 기록하고 `getWallet()`으로 계산한다. 지급·차감은 `lockUser(tx, userId)`를 건 트랜잭션 안에서 `grantReward()` 사용. 규칙 숫자는 `src/lib/game.ts`.
- **헤더 갱신**: 코인·캐릭터가 바뀌는 Server Action은 `revalidatePath("/", "layout")`을 호출한다 (루트 레이아웃은 이동만으로 다시 그려지지 않는다).
- **글 HTML**: 저장 전에 `sanitizePostHtml()`로 정화한다. 허용 태그를 늘리면 에디터와 `src/server/sanitize.ts`를 같이 고친다.
- **그림**: DB에는 `asset_key`만. 실제 모양은 `src/lib/assets.ts` (현재 이모지·그라데이션, 나중에 스프라이트로 교체 예정).
- **검증**: `npx tsc --noEmit`, `npx eslint`, 개발 서버를 띄운 상태에서 `npm run db:reset` 후 `node e2e/blog.mjs <폴더>`, `node e2e/game.mjs <폴더>`. 화면 변경은 스크린샷으로 확인한다.
