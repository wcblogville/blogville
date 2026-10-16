# 요구사항 ↔ 테스트 연결표

> 자동으로 만든 파일이다. 손으로 고치지 말고 `npm run test:trace`로 다시 만든다.
> 시험 파일 안에 요구사항 ID(예: `AUTH-07`)를 주석으로 적으면 여기에 잡힌다. 전략은 [03-test-strategy.md](03-test-strategy.md).

## 요약

- 구현된 요구사항(✅·🚧) **95개** 중 시험이 있는 것 **78개 (82%)**
- 그중 PR마다 자동으로 확인하는 것 **49개 (52%)**
- 시험 파일: 단위 13개, E2E 50개 (PR 12 · 매일 밤 37 · 손으로 1)

표시: 이름만 = PR마다(단위 테스트·CI E2E), 🌙 = 매일 밤 전체 E2E, ✋ = 손으로 돌리는 시험

## 시험이 없는 구현된 요구사항

- **GAME-03** 활동으로 코인을 얻는다 (S)
- **SHOP-05** 내 집 (C)
- **NF-01** DB 접속 정보, 로그인 비밀키, 소셜 Client Secret, 관리자 비밀번호는 서버 환경 변수 (M)
- **NF-09** 비밀번호는 해시로만 저장하고, 원문을 DB·로그·화면 어디에도 남기지 않는다 (M)
- **NF-13** DB 쿼리는 ORM의 값 바인딩으로만 만들고, 입력값을 SQL 문자열에 이어 붙이지 않는다 (M)
- **NF-14** 배포 전 관리자 비밀번호를 12자 이상, 추측하기 어려운 값으로 바꾼다 (M)
- **NF-04** 코인 지급·차감, 아이템 구매는 트랜잭션으로 처리한다 (M)
- **NF-05** 출석은 하루 (M)
- **NF-15** "한 글에 공감 한 번", "보유한 아이템만 장착" 같은 규칙은 앱 코드뿐 아니라 DB 제약조건으로도 막는다 (M)
- **NF-16** 코인·경험치·레벨은 따로 저장하지 않고 원장 합계로 계산한다 (M)
- **NF-18** 키보드 (S)
- **NF-08** main에 merge하면 자동으로, 사이트를 멈추지 않고 배포된다 (S)
- **NF-22** DB 구조 변경은 마이그레이션 파일로만 한다 (M)
- **NF-23** merge 전에 타입 검사·린트·E2E를 통과한다 (S)
- **NF-27** 매일 밤 전체 E2E와 주요 화면 성능 (S)
- **NF-25** 캐릭터·배경·글꼴 등 에셋은 상업적 이용까지 허용된 것만 쓰고 출처를 남긴다 (S)
- **NF-26** 서비스에 필요한 최소한의 정보만 저장한다 (S)

## AUTH

| ID | 요구사항 | 우선 | 상태 | 확인하는 시험 |
|---|---|---|---|---|
| AUTH-01 | 연동해 둔 네이버, 카카오, 구글 계정으로 로그인할 수 있다 | M | ⬜ | `test-auth.ts`, `test-oauth.ts`, `auth.mjs`, `signup.mjs` 🌙 |
| AUTH-02 | 처음 로그인하면 온보딩 | M | ✅ | `auth.mjs` |
| AUTH-03 | 닉네임과 블로그 주소는 서비스 전체에서 중복될 수 없다 | M | ✅ | `test-auth.ts` |
| AUTH-04 | 로그아웃할 수 있다 | M | ✅ | `session.mjs` 🌙 |
| AUTH-05 | 사이트 아이디로 가입한 회원이 소셜 계정을 연동·해제할 수 있다 | S | ⬜ | `test-oauth.ts`, `account.mjs` 🌙 |
| AUTH-06 | 회원 탈퇴 시 개인정보와 글을 삭제한다 | S | ✅ | `account.mjs` 🌙 |
| AUTH-07 | 사이트 자체 아이디와 비밀번호로 회원가입할 수 있다 | M | ✅ | `test-auth.ts`, `test-blog.ts`, `signup.mjs` 🌙 |
| AUTH-08 | 관리자는 관리자 페이지에서 통계·회원 목록을 보고 어떤 글이든 삭제할 수 있다 | S | 🚧 | `auth.mjs` |
| AUTH-09 | 사이트 아이디와 비밀번호로 로그인할 수 있다 | M | ✅ | `test-auth.ts`, `login-limit.mjs` 🌙, `session.mjs` 🌙 |
| AUTH-10 | 관리자는 관리자 페이지에서 회원 | C | ✅ | `test-game.ts`, `admin-grant.mjs` 🌙 |
| AUTH-11 | 로그인한 회원은 회원정보 수정 화면에서 비밀번호를 바꾸고 프로필 사진·닉네임을 고칠 수 있다 | S | ✅ | `account.mjs` 🌙 |
| AUTH-12 | 비밀번호를 잊은 회원은 비밀번호 찾기로 새 비밀번호를 정할 수 있다 | S | ✅ | `test-auth.ts`, `find-password.mjs` 🌙 |

## BLOG

| ID | 요구사항 | 우선 | 상태 | 확인하는 시험 |
|---|---|---|---|---|
| BLOG-01 | 회원 한 명은 블로그 하나를 가진다 | M | ✅ | `test-blog.ts`, `blog-home.mjs` 🌙 |
| BLOG-02 | 블로그 주소는 /@블로그주소 형식이다 | M | ✅ | `blog-home.mjs` 🌙, `params.mjs` 🌙 |
| BLOG-03 | 블로그 이름·소개와, 가입 때 자동으로 정한 블로그 주소·닉네임을 바꿀 수 있다 | M | ✅ | `test-blog.ts`, `blog-address.mjs` 🌙, `params.mjs` 🌙 |
| BLOG-04 | 블로그 위쪽에 제목 줄 | M | ✅ | `blog-showcase.mjs` 🌙, `blog.mjs`, `params.mjs` 🌙 |
| BLOG-05 | 블로그마다 카테고리를 2단계 | S | ✅ | `categories.mjs` 🌙, `params.mjs` 🌙, `visits.mjs` 🌙 |
| BLOG-06 | 블로그 방문자 수 | C | ✅ | `visits.mjs` 🌙 |
| BLOG-07 | 내 블로그에서 마을의 글·블로그를 검색한다 | S | ✅ | `blog-search.mjs` 🌙 |
| BLOG-08 | 주인은 블로그 홈의 도구 막대 | S | ✅ | `board-blog.mjs` |
| BLOG-10 | 블로그 주인은 방문자 기록 | C | ✅ | `visits.mjs` 🌙 |
| BLOG-09 | 블로그 홈 오른쪽 옆 칸 위젯 | S | ✅ | `board-blog.mjs` |

## POST

| ID | 요구사항 | 우선 | 상태 | 확인하는 시험 |
|---|---|---|---|---|
| POST-01 | 에디터 | M | ✅ | `test-post.ts`, `blog.mjs`, `farm.mjs` 🌙, `post-write.mjs` 🌙, `write-count.mjs` 🌙 |
| POST-02 | 글은 공개 / 👥 이웃 공개 / 비공개를 정할 수 있다 | M | ✅ | `test-post.ts`, `all-posts.mjs` 🌙, `attachment-links.mjs` 🌙, `post-write.mjs` 🌙 |
| POST-03 | 글에 카테고리를 지정할 수 있다 | S | ✅ | `params.mjs` 🌙, `post-categories.mjs` 🌙 |
| POST-04 | 글에 태그를 여러 개 달 수 있고, 태그별로 모아볼 수 있다 | S | ✅ | `blog.mjs`, `post-lists.mjs` 🌙 |
| POST-05 | 글 목록은 최신순, 페이지 단위로 보여준다 | M | ✅ | `params.mjs` 🌙, `post-lists.mjs` 🌙 |
| POST-06 | 글 조회수를 센다 | S | ✅ | `post-views.mjs` 🌙 |
| POST-07 | 글에 이미지를 첨부할 수 있다 | C | ✅ | `test-post.ts`, `test-sanitize.ts`, `test-text-length.ts`, `attachment-links.mjs` 🌙, `attachments.mjs` 🌙 |
| POST-08 | 작성 중인 글을 임시 저장할 수 있다 | C | ✅ | `post-drafts.mjs` 🌙 |
| POST-09 | 글에 파일을 첨부하고, 원래 이름으로 내려받을 수 있다 | C | ✅ | `test-post.ts`, `test-sanitize.ts`, `test-text-length.ts`, `attachment-links.mjs` 🌙, `attachments.mjs` 🌙 |

## SOC

| ID | 요구사항 | 우선 | 상태 | 확인하는 시험 |
|---|---|---|---|---|
| SOC-01 | 회원은 글에 댓글을 쓰고, 자기 댓글을 삭제할 수 있다 | M | ✅ | `test-social.ts`, `comments.mjs` 🌙, `params.mjs` 🌙 |
| SOC-02 | 댓글에 답글 | C | ✅ | `comments.mjs` 🌙, `params.mjs` 🌙 |
| SOC-03 | 회원은 글에 공감 | M | ✅ | `social.mjs` 🌙 |
| SOC-04 | 다른 블로그를 이웃으로 추가하고, 이웃의 새 글을 모아볼 수 있다 | S | ✅ | `social.mjs` 🌙 |
| SOC-05 | 마을 소식 | M | ✅ | `all-posts.mjs` 🌙, `feed-load.mjs` 🌙, `params.mjs` 🌙, `social.mjs` 🌙 |
| SOC-06 | 블로그 주인의 이웃 목록 | S | ✅ | `test-notifications.ts`, `neighbors.mjs` |

## GAME

| ID | 요구사항 | 우선 | 상태 | 확인하는 시험 |
|---|---|---|---|---|
| GAME-01 | 가입 시 기본 캐릭터 2종 | M | ✅ | `decisions.mjs` 🌙, `rewards.mjs` 🌙 |
| GAME-02 | 활동으로 경험치를 얻고, 경험치에 따라 레벨이 오른다 | S | ✅ | `test-game.ts`, `decisions.mjs` 🌙, `mobile.mjs` 🌙 |
| GAME-03 | 활동으로 코인을 얻는다 | S | ✅ | **없음** |
| GAME-04 | 로그인하면 하루 한 번 자동 출석하고, 7일 주기 출석 보상을 받는다 | S | ✅ | `test-game.ts`, `attendance.mjs` 🌙, `decisions.mjs` 🌙, `signup.mjs` 🌙 |
| GAME-05 | 보상 규칙 | S | ✅ | `post-write.mjs` 🌙, `write-count.mjs` 🌙 |
| GAME-06 | 레벨이 오르면 팝업으로 알려준다 | C | ✅ | `test-game.ts`, `test-notifications.ts`, `notifications.mjs` 🌙 |
| GAME-07 | 내 경험치·코인을 언제 무엇으로 얻고 썼는지 내역 화면에서 본다 | S | ✅ | `decisions.mjs` 🌙 |
| GAME-08 | 레벨업과 내 글에 달린 공감·댓글, 내 댓글에 달린 답글을 알림함 | C | ✅ | `test-notifications.ts`, `account.mjs` 🌙, `notifications.mjs` 🌙 |
| GAME-09 | 친구를 초대하면 | C | ❌ | - |

## SHOP

| ID | 요구사항 | 우선 | 상태 | 확인하는 시험 |
|---|---|---|---|---|
| SHOP-01 | 상점에서 아바타 꾸미기 | S | ✅ | `test-shop.ts`, `booster.mjs`, `shop.mjs` |
| SHOP-02 | 일부 아이템은 일정 레벨 이상이어야 살 수 있다 | S | ✅ | `shop.mjs` |
| SHOP-03 | 코인이 부족하면 살 수 없다 | S | ✅ | `shop.mjs` |
| SHOP-04 | 내 인벤토리에서 보유한 캐릭터와 배경을 장착할 수 있다 | M | ✅ | `decisions.mjs` 🌙 |
| SHOP-05 | 내 집 | C | ✅ | **없음** |
| SHOP-06 | 산 아바타 꾸미기 아이템 | S | ✅ | `test-shop.ts` |
| SHOP-07 | 광장의 미용실 | C | ✅ | `test-style.ts`, `style.mjs` |
| SHOP-08 | 광장의 옷가게 | C | ✅ | `test-style.ts` |

## TOWN

| ID | 요구사항 | 우선 | 상태 | 확인하는 시험 |
|---|---|---|---|---|
| TOWN-01 | 로그인하면 마을 | M | ✅ | `decisions.mjs` 🌙 |
| TOWN-02 | 내 캐릭터를 키보드 | M | ✅ | `test-game.ts`, `decisions.mjs` 🌙, `town-walk.mjs` |
| TOWN-03 | 마을의 건물·집·우체통에 다가가 들어가면 해당 화면 | M | ✅ | `town-walk.mjs`, `town.mjs` |
| TOWN-04 | 마을 길가 집 자리 11곳에 내 집과 내가 즐겨찾기한 이웃의 집 | S | ✅ | `decisions.mjs` 🌙 |
| TOWN-05 | 마을을 2.5D | S | ✅ | `test-game.ts` |
| TOWN-06 | 다른 사람이 광장에서 움직이는 모습을 실시간으로 본다 | W | ❌ | - |
| TOWN-07 | 마을의 내 집 지붕 색을 10가지 중 열린 색에서 고른다 | C | ✅ | `test-blog.ts`, `test-game.ts`, `house.mjs` |
| TOWN-08 | 이웃 중에서 즐겨찾는 이웃을 최대 10명 정하고 | S | ✅ | `post-lists.mjs` 🌙 |
| TOWN-09 | 동물 농장에서 동물을 키워 경험치·코인을 얻는다 | S | ✅ | `test-game.ts`, `booster.mjs`, `farm.mjs` 🌙 |
| TOWN-10 | 화면 맨 위 헤더 | S | ❌ | - |
| TOWN-11 | 마을의 집이 주인 레벨에 따라 10단계로 성장한다 | C | ✅ | `test-game.ts` |
| TOWN-12 | ☰ 마을 메뉴 하나로 내 프로필·알림·텔레포트·친구 목록·내 정보·로그아웃을 쓴다 | M | ✅ | `town.mjs` |
| TOWN-13 | 집 앞 우체통에서 내 집은 내 알림을, 다른 집은 그 집의 새 글을 본다 | S | ✅ | `town.mjs` |
| TOWN-14 | 마을의 연못 낚시터에서 하루 세 번 낚싯대를 던져 | C | ✅ | `test-shop.ts` |
| TOWN-15 | 다른 회원의 마을 | S | ✅ | `plaza.mjs` |
| TOWN-16 | 상점에서 산 광장 장식을 내 마을의 장식 자리 | C | ❌ | `test-game.ts`, `test-shop.ts`, `plaza.mjs` |
| TOWN-17 | 광장 캐릭터가 걷는 방향 | C | ✅ | `test-style.ts`, `style.mjs` |
| TOWN-18 | 즐겨찾기 이웃이 어느 집 자리 | C | ✅ | `test-game.ts`, `plaza.mjs`, `town.mjs` |
| TOWN-19 | 즐겨찾기 이웃의 캐릭터가 마을 길을 걸어 다닌다 | C | ✅ | `town.mjs` |
| TOWN-20 | 내 정원 | C | ✅ | `test-game.ts` |
| TOWN-21 | 블로그 우리 집에 전시한 동물이 광장에서 나를 따라다닌다 | C | ✅ | `town.mjs` |
| TOWN-22 | 캐릭터를 가만히 두면 재미있는 동작을 무작위로 하나 한다 | C | ✅ | `test-idle-theme.ts`, `idle-theme.mjs` 🌙 |
| TOWN-23 | 꾸미기에서 고른 배경이 마을 분위기 | C | ✅ | `test-idle-theme.ts`, `idle-theme.mjs` 🌙 |
| TOWN-24 | 걸어 다니는 이웃을 누르거나 가까이서 Space를 누르면 말풍선으로 한마디 | C | ✅ | `test-idle-theme.ts`, `idle-theme.mjs` 🌙 |

## NF

| ID | 요구사항 | 우선 | 상태 | 확인하는 시험 |
|---|---|---|---|---|
| NF-01 | DB 접속 정보, 로그인 비밀키, 소셜 Client Secret, 관리자 비밀번호는 서버 환경 변수 | M | ✅ | **없음** |
| NF-02 | 글 수정·삭제, 장착, 구매, 관리자 기능의 권한 검사는 모두 서버에서 한다 | M | ✅ | `params.mjs` 🌙 |
| NF-03 | 에디터로 쓴 HTML은 저장할 때 허용 태그만 남기고 정화해서 XSS를 막는다 | M | ✅ | `test-sanitize.ts` |
| NF-09 | 비밀번호는 해시로만 저장하고, 원문을 DB·로그·화면 어디에도 남기지 않는다 | M | ✅ | **없음** |
| NF-10 | 같은 아이디로 짧은 시간에 로그인을 여러 번 실패하면 잠시 막는다 | S | ✅ | `login-limit.mjs` 🌙 |
| NF-11 | 로그인 쿠키는 자바스크립트로 읽을 수 없고 | M | 🚧 | `session.mjs` 🌙 |
| NF-12 | 로그인한 사용자의 쿠키를 이용해 다른 사이트에서 보낸 요청 | M | ✅ | `session.mjs` 🌙 |
| NF-13 | DB 쿼리는 ORM의 값 바인딩으로만 만들고, 입력값을 SQL 문자열에 이어 붙이지 않는다 | M | ✅ | **없음** |
| NF-14 | 배포 전 관리자 비밀번호를 12자 이상, 추측하기 어려운 값으로 바꾼다 | M | ✅ | **없음** |
| NF-04 | 코인 지급·차감, 아이템 구매는 트랜잭션으로 처리한다 | M | ✅ | **없음** |
| NF-05 | 출석은 하루 | M | ✅ | **없음** |
| NF-15 | "한 글에 공감 한 번", "보유한 아이템만 장착" 같은 규칙은 앱 코드뿐 아니라 DB 제약조건으로도 막는다 | M | ✅ | **없음** |
| NF-16 | 코인·경험치·레벨은 따로 저장하지 않고 원장 합계로 계산한다 | M | ✅ | **없음** |
| NF-06 | 휴대폰 | M | 🚧 | `attachments.mjs` 🌙, `nonfunctional.mjs` 🌙 |
| NF-17 | 광장 | W | ❌ | - |
| NF-18 | 키보드 | S | ✅ | **없음** |
| NF-19 | 오류 문구는 한국어로, 무엇을 고치면 되는지 알려준다 | S | ✅ | `test-oauth.ts`, `account.mjs` 🌙, `auth.mjs`, `blog.mjs`, `signup.mjs` 🌙 |
| NF-07 | 글 목록 화면은 1초 안에 보인다 | M | 🚧 | `blog-scale.mjs` 🌙, `feed-load.mjs` 🌙, `nonfunctional.mjs` 🌙 |
| NF-20 | 광장은 일반 노트북·최근 스마트폰에서 끊김 없이 | C | ⬜ | - |
| NF-21 | 최신 Chrome, Edge, Safari, 모바일 Chrome·Safari에서 동작한다 | S | ⬜ | - |
| NF-08 | main에 merge하면 자동으로, 사이트를 멈추지 않고 배포된다 | S | 🚧 | **없음** |
| NF-22 | DB 구조 변경은 마이그레이션 파일로만 한다 | M | ✅ | **없음** |
| NF-23 | merge 전에 타입 검사·린트·E2E를 통과한다 | S | ✅ | **없음** |
| NF-27 | 매일 밤 전체 E2E와 주요 화면 성능 | S | ✅ | **없음** |
| NF-24 | 배포 DB는 매일 백업하고, 복구 방법을 문서로 남긴다 | S | ⬜ | - |
| NF-25 | 캐릭터·배경·글꼴 등 에셋은 상업적 이용까지 허용된 것만 쓰고 출처를 남긴다 | S | ✅ | **없음** |
| NF-26 | 서비스에 필요한 최소한의 정보만 저장한다 | S | 🚧 | **없음** |
