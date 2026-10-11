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
- **배포**: main에 push하면 GitHub Actions "배포"(`.github/workflows/deploy.yml`)가 도커 이미지(`Dockerfile`, Turbopack 빌드가 한글 코드 위치 표시에서 멈춰 `next build --webpack`)를 만들어 서버 `~/blogville`로 보내고 SSH로 `scripts/deploy.sh`를 실행한다 (DB 접속 확인 → DB 준비 → 컨테이너 재시작 → 첫 화면 응답 확인 → `~/nginx` 설정·DNS·서버 nginx 응답 안내(실패해도 배포는 성공). 도커 기본 네트워크에서 DB에 못 가면 `--network host`로 띄우고 앱이 `PORT`로 직접 연다. 공용 서버라 `docker image prune` 대신 내 옛 이미지만 지운다. 포트 8420·사이트 주소는 deploy.yml 맨 위 `env`, 첨부는 `~/blogville/uploads`). `BETTER_AUTH_SECRET`·`ADMIN_USERNAME`·`ADMIN_PASSWORD`는 GitHub secret이 없으면 서버가 한 번 만들어 `~/blogville/.secrets`에 보관한다. nginx 뒤의 Server Action을 위해 `next.config.ts`의 `serverActions.allowedOrigins`에 사이트 주소를 둔다. DB는 크로우풋이 발급한 PostgreSQL(전용 스키마 `DB_SCHEMA`, public 못 씀)이라 표는 `npm run db:migrate:deploy`(`scripts/migrate-deploy.ts`, SQL의 `"public".`을 스키마로 바꿔 적용)로 만들고, 접속 주소에 `?options=-c search_path=<스키마>`를 붙인다. 크로우풋 ERD(문서 675)는 그림용이고 DB의 원본은 drizzle 마이그레이션이다.
- **인증**: 페이지와 Server Action마다 `requireMember()`(비로그인 → `/`) / `requireAdmin()`(비로그인·일반 회원 모두 404) (`src/server/dal.ts`). `requireUser()`는 없다 (온보딩이 없어져 로그인한 회원은 늘 프로필·블로그가 있다). 레이아웃에서 권한 검사를 하지 않는다.
- **보상·코인**: 잔액 컬럼을 만들지 않는다. `point_ledger`에 기록하고 `getWallet()`으로 계산한다. 지급·차감은 `lockUser(tx, userId)`를 건 트랜잭션 안에서 `grantReward()` 사용. 규칙 숫자는 `src/lib/game.ts`.
- **경험치·레벨업**: 경험치가 생기는 원장 기록은 `addLedgerEntry()`(또는 그것을 부르는 `grantReward()`)로만 넣는다. 레벨이 오르면 같은 트랜잭션에 `level_up` 알림을 넣는다. 경험치 0인 구매(`purchase`, `egg_purchase`)만 직접 INSERT해도 된다.
- **자동 출석**: `getViewer()`가 오늘(한국 시간) 출석이 없으면 `ensureTodayAttendance()`(`src/server/attendance.ts`)로 출석과 일차 보상(`attendance_rewards`)을 한 트랜잭션에 기록한다. 그래서 `requireMember()`·`getViewer()`는 `db.transaction()` 밖에서, Server Action·페이지 맨 앞에서 먼저 부른다.
- **알림**: 표는 `notifications`(레벨업·공감·댓글·답글). 공감·댓글·답글 알림은 그 Action의 트랜잭션 안에서 `notifyActivity()`(`src/server/notifications.ts`)로 넣는다. 닉네임·글 제목은 저장하지 않고 보여 줄 때 JOIN한다.
- **헤더 갱신**: 코인·캐릭터가 바뀌는 Server Action은 `revalidatePath("/", "layout")`을 호출한다 (루트 레이아웃은 이동만으로 다시 그려지지 않는다).
- **글 HTML**: 저장 전에 `sanitizePostHtml()`로 정화한다. 허용 태그를 늘리면 에디터와 `src/server/sanitize.ts`를 같이 고친다. 글 입력 검사 순서·문구는 `src/lib/post-rules.ts`(`postInputSchema`, 브라우저·서버 공용).
- **첨부**: 글을 저장할 때 본문의 내 첨부가 그 글에 붙는다(`attachments.post_id`, `src/server/posts.ts` `lockLinkableAttachments`). 비공개 글 첨부는 주인만, 안 붙은 첨부는 올린 사람만 연다(`attachmentAccess`). 하루 넘게 안 붙은 첨부는 `npm run posts:cleanup`이 지운다.
- **조회수**: 같은 브라우저(쿠키 `bv_visitor`, `src/server/visitor.ts`)는 글마다 하루 1번(`post_views`). 서버 렌더는 조회수를 바꾸지 않고 `ViewCount`가 `recordPostView`를 한 번 부른다.
- **댓글·답글**: 답글은 `replies` 표(1단계). 지우면 행을 남기고 `deleted_at` + 내용 빈 글자(CHECK). 댓글 수는 `src/server/social.ts`의 `liveCommentCountSql`(댓글 + 답글). 탈퇴는 회원을 지우기 전에 `prepareCommentsForWithdrawal`을 불러야 한다(안 부르면 `comments_author_check`가 막는다).
- **그림**: DB에는 `asset_key`만. 실제 모양은 `src/lib/art/`에서 코드로 그린 SVG (`characters.ts` 캐릭터, `backgrounds.ts` 배경, `town.ts` 광장 건물). 외부 그림 파일을 쓰지 않는다. 아이소메트릭(TOWN-05) 전까지 2D. 캐릭터·아바타·광장 건물·장식·바닥은 도트(2026-10-09 결정): `pixel.ts`의 팔레트 + 글자 줄(한 글자 = 한 픽셀, `Pix` 도화지), 캐릭터 16×24(아바타 부품도 같은 틀), 광장은 모두 `PIXEL`(3)배, 바닥은 `src/components/town/ground.ts`가 한 번 굽고 Phaser는 `pixelArt: true`. 크기를 늘이거나 줄이지 않는다(정수배). 가구·성장 아이템·동물(단계마다 따로 그림)은 32×32, 미니룸 배경은 60줄(블로그 위쪽 5배, 상점 2배), 집 방 벽지·마루·창·문은 `room.ts`(4배). 미리보기는 `fitSvg(rows, size)`로 정수배 틀에 담으니 화면 크기(size)를 32·24의 배수(64·72·96)로 둔다. 첫 화면(로그인·회원가입) 풍경은 `src/lib/art/landing.ts`(도트 제목·구름·언덕·잔디·흙길) + 광장 그림을 `src/components/landing-scene.tsx`가 3배로 늘어놓고, 판·버튼·입력 칸은 `globals.css`의 `pixel-panel`·`pixel-btn`·`pixel-input`을 쓴다 (첫 화면에는 헤더 막대가 없다).
- **광장이 메인**: 헤더에 다른 화면으로 가는 메뉴를 두지 않는다. 광장 밖 화면은 헤더의 `← 광장으로 나가기`(`src/components/exit-button.tsx`)로 돌아온다. 새 장소는 광장 건물 입구(`scene.ts`의 `entrances`)로 연결한다. 좌표·텔레포트 목록은 `src/components/town/layout.ts` 하나에서 정하고, 게임과 화면 위 메뉴(`town-hud.tsx`)는 `bus.ts`(teleport·open·panel 신호)로만 주고받는다.
- **휴대폰(`phone:`, `src/lib/device.ts` `PHONE_MEDIA`)은 광장이 없다** (2026-10-09 결정): 회원의 `/town`은 내 블로그로 옮기고(`phone-home.tsx`), 아래 탭(`src/components/mobile-tab-bar.tsx`: 내 블로그·마을 소식·상점·알림·☰ 메뉴)으로 다닌다. ☰ 메뉴는 `/town?menu=1`(`town-menu.tsx`, 내 프로필 + 탭에 없는 장소). 휴대폰 회원에게는 나가기·집의 🚪 문을 숨긴다. 새 장소는 광장 입구와 함께 ☰ 메뉴에도 넣는다.
- **친구 마을** (2026-10-09 요청): 다른 회원의 마을은 `/town/[slug]`(`TownData.host`, 0번 집 = 그 회원의 집, 둘레 = 그 회원의 즐겨찾기), 화면 틀은 `town-screen.tsx`를 같이 쓴다. **광장 꾸미기는 뺐다** (사용자 결정 2026-10-11: 집 꾸미기에 집중, TOWN-16 ❌): `town_decorations` 표·장식 아이템·산 장식 데이터는 남기고(지우지 않는다), 광장에 그리지도 상점에서 팔지도 않는다(seed가 `deco`를 `is_on_sale = false`). 앞으로 꾸미기는 집(블로그의 우리 집) 쪽을 키운다.
- **미용실·옷가게** (SHOP-07·08): `/salon`·`/clothes`가 `style-studio.tsx`(거울 + 계산서)를 같이 쓰고, 저장은 `src/server/style.ts` `applyStyle`(트랜잭션 + `lockUser`, 화면 합계 `pay`가 서버 합계와 같아야 함, 0코인은 원장에 안 씀). 가게별 부위는 `src/lib/style.ts` `STYLE_PLACES`. 머리 모양·색은 아바타 부위 `hair`·`hair_color`(그림 `src/lib/art/hair.ts`, 사람 캐릭터만)이고 상점에는 안 나온다. 광장 캐릭터 걷기는 `src/lib/art/walk.ts` 그림판(방향 4줄 × 5칸)을 Phaser 애니메이션으로 돌린다(TOWN-17), 분수는 3칸 그림판(`fountainSheetSvg`).
- **기본 캐릭터**: 가입할 때 남자/여자 주민(`is_starter`) 중 하나만 받는다. 아이템을 바꾸면 `npm run db:seed`.
- **로그인**: 아이디 로그인은 Better Auth `username` 플러그인. 가입은 온보딩 없이 한 트랜잭션(`src/server/signup.ts` `createMember`, 폼은 `src/app/(auth)/actions.ts`)으로 회원·프로필·블로그를 함께 만든다 (대체 이메일 `아이디@users.blogville.invalid`). 소셜은 가입 없이 내 정보(`/settings/account`)에서 연동만 한다. 관리자는 `users.role = 'admin'`, `requireAdmin()`. 관리자 계정은 `npm run admin:create` (비밀번호 12~64자, `.env.local`에만, 코드·문서에 쓰지 않는다).
- **라이브러리 HTTP 경로**: `src/app/api/auth/[...all]/route.ts`는 **허용 목록**만 Better Auth로 넘기고 나머지는 404다 (`get-session`, 소셜 `callback/*`, `error`). 가입·로그인·로그아웃·연동·해제·탈퇴는 Server Action이 서버에서 `auth.api.*`를 부른다. 새 경로가 필요하면 허용 목록에 이유와 함께 한 줄 더한다.
- **이름 규칙**: 아이디·블로그 주소·닉네임의 형식·예약어는 `src/lib/names.ts`(순수 함수, `RESERVED_NAMES`·`normalizeName`·`USERNAME_RE`), 서로 겹치는지는 `src/server/names.ts`(`lockName` → `findNameConflict`, 트랜잭션 안에서). 이름을 바꾸는 코드는 이 순서를 따른다.
- **탈퇴**: `src/server/account.ts` `deleteMember` 한 트랜잭션 (`users` 삭제 + CASCADE). 회원을 가리키는 새 표는 FK를 `ON DELETE CASCADE` 또는 `SET NULL`로 둔다 (아니면 탈퇴가 막힌다). FK 없는 표(`login_attempts`)는 `deleteMember`와 `scripts/reset-dev.ts`에서 직접 지운다.
- **검증**: `npx tsc --noEmit`, `npx eslint`, `npm test`, 개발 서버를 띄운 상태에서 `npm run db:seed && npm run db:reset && npm run admin:create` 후 `node e2e/auth.mjs <폴더>` (회원/인증은 `signup`·`session`·`login-limit`·`account`도), `node e2e/blog.mjs <폴더>` (글은 `post-write`·`post-lists`·`post-categories`·`post-views`·`attachment-links`·`post-drafts`도), `node e2e/game.mjs <폴더>` (상점·꾸미기는 `shop`도, 친구 마을은 `plaza`, 미용실·옷가게·걷기는 `style`). E2E 서버 주소는 `E2E_BASE`(기본 `http://localhost:3000`). 아바타·성장 아이템을 바꾸면 `npm run db:seed`. `e2e/flow.mjs`는 예전 온보딩 흐름이라 낡았다. 화면 변경은 스크린샷으로 확인한다.
