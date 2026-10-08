// 내 정보: 소셜 연동·해제 (AUTH-05 / FR-036~FR-042, FR-054, SC-011 / quickstart 4.5의 1~11번)
// 회원 탈퇴 (AUTH-06 / FR-050~FR-052, SC-014 / quickstart 4.5의 12~20번)
// 사용: 개발 서버를 띄운 상태에서 node e2e/account.mjs <스크린샷 폴더>
// 소셜 키 없이 확인한다. "연동됨" 상태는 DB에 소셜 로그인 수단 행을 직접 넣어 만든다 (실제 연동 흐름은 quickstart 6장 수동 확인).
// DB는 .env.local의 DATABASE_URL로 준비·확인한다. 실행마다 새 아이디를 쓴다.
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();

const n = Date.now() % 100_000_000;
const ID = `ac${n}`;
const PW = "account-pass-1234";
const LABEL = { kakao: "카카오", naver: "네이버", google: "Google" };
const SOCIAL_KEYS = ["KAKAO", "NAVER", "GOOGLE"].filter((k) => process.env[`${k}_CLIENT_ID`] && process.env[`${k}_CLIENT_SECRET`]);
// 화면과 같은 날짜 표기 (src/lib/format.ts formatDate)
const today = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const one = async (q, params) => (await db.query(q, params)).rows[0];
const userId = async () => (await one("SELECT id FROM users WHERE username = $1", [ID])).id;
const rows = async (provider) =>
  (await one("SELECT count(*)::int AS c FROM accounts WHERE user_id = $1 AND provider_id = $2", [await userId(), provider])).c;
const insertSocial = async (provider, accountId = `${provider}-${n}`) =>
  db.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, $3, $4)", [randomUUID(), await userId(), provider, accountId]);

async function fresh(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  return { ctx, page, errors: collectErrors(page) };
}

const row = (page, provider) => page.locator(`li[data-provider="${provider}"]`);
const accountPage = async (page, query = "") => {
  await page.goto(`${BASE}/settings/account${query}`);
  await page.getByRole("heading", { name: "로그인 수단" }).waitFor();
};

/** 화면의 Server Action 요청을 잡는다 (Next-Action 헤더·본문). 그 요청의 인자만 바꿔 "조작한 요청"을 만든다 */
async function captureAction(page, trigger) {
  const reqP = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await trigger();
  const req = await reqP;
  return { id: req.headers()["next-action"], contentType: req.headers()["content-type"], body: req.postData() ?? "" };
}

/** 잡아 둔 Server Action을 다른 인자로 보낸다 (로그인한 페이지의 쿠키로). 결과: { status, redirect } */
const sendAction = (page, action, args) =>
  page.evaluate(
    async ({ id, contentType, body }) => {
      const res = await fetch("/settings/account", {
        method: "POST",
        headers: { "Next-Action": id, Accept: "text/x-component", "Content-Type": contentType },
        body,
      });
      await res.text();
      return { status: res.status, redirect: res.headers.get("x-action-redirect") ?? "" };
    },
    { id: action.id, contentType: action.contentType, body: JSON.stringify(args) },
  );

if (SOCIAL_KEYS.length) results.push(`ℹ️ 소셜 키가 있는 서비스: ${SOCIAL_KEYS.join(", ")} (2번의 [연동하기] 비활성 확인은 키가 없을 때 기준)`);

// ── 1) 로그인하지 않고 /settings/account → / ──
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/settings/account`);
  check("1 비로그인 /settings/account → /", new URL(page.url()).pathname === "/", page.url());
  await ctx.close();
}

const { ctx, page, errors } = await fresh();
await loginDev(page, ID, "남자 주민", PW);

// ── 2) 내 정보: 아이디 로그인 줄(해제 버튼 없음), 카카오·네이버·Google [연동하기] (키가 없어 비활성) ──
{
  await accountPage(page);
  check("2 탭 제목 `내 정보`", (await page.title()).includes("내 정보"), await page.title());
  const cred = row(page, "credential");
  check("2 `아이디 로그인 · {아이디}`", (await cred.innerText()).trim() === `아이디 로그인 · ${ID}`, await cred.innerText());
  check("2 아이디 로그인 줄에 해제 버튼 없음", (await cred.getByRole("button").count()) === 0);
  for (const p of ["kakao", "naver", "google"]) {
    const btn = row(page, p).getByRole("button", { name: `${LABEL[p]} 연동하기` });
    const state = await btn.evaluate((b) => ({ disabled: b.disabled, title: b.title, opacity: getComputedStyle(b).opacity }));
    const expectDisabled = !SOCIAL_KEYS.includes(p.toUpperCase());
    check(
      `2 [${LABEL[p]} 연동하기] ${expectDisabled ? "비활성 + 아직 연결 준비 중이에요" : "활성"}`,
      expectDisabled ? state.disabled && state.title === "아직 연결 준비 중이에요" && Number(state.opacity) < 1 : !state.disabled,
      JSON.stringify(state),
    );
  }
  await page.screenshot({ path: `${outDir}/80-account.png`, fullPage: true });
}

// ── 3) 블로그 관리의 `내 정보` 링크, 헤더 캐릭터 배지 → /settings/account ──
{
  await page.goto(`${BASE}/settings/blog`);
  await page.getByRole("main").getByRole("link", { name: "내 정보", exact: true }).click();
  await page.waitForURL(/\/settings\/account$/, { timeout: 10000 }).catch(() => {});
  check("3 블로그 관리 `내 정보` 링크 → 내 정보", new URL(page.url()).pathname === "/settings/account", page.url());
  await page.goto(`${BASE}/town`);
  await page.getByRole("banner").getByRole("link", { name: "내 정보" }).click();
  await page.waitForURL(/\/settings\/account$/, { timeout: 10000 }).catch(() => {});
  check("3 헤더 캐릭터 배지 → 내 정보", new URL(page.url()).pathname === "/settings/account", page.url());
}

// ── 4) DB에 카카오 연동 행 → `연동됨 ({오늘 날짜})` + [연동 해제] ──
await insertSocial("kakao");
{
  await accountPage(page);
  const kakao = row(page, "kakao");
  check("4 카카오 `연동됨 (오늘)`", await kakao.getByText(`연동됨 (${today})`, { exact: true }).isVisible(), await kakao.innerText());
  check("4 카카오 [연동 해제] 있음, [연동하기] 없음",
    (await kakao.getByRole("button", { name: "연동 해제" }).count()) === 1 && (await kakao.getByRole("button", { name: /연동하기/ }).count()) === 0);
  check("4 네이버는 그대로 [연동하기]", (await row(page, "naver").getByRole("button", { name: "네이버 연동하기" }).count()) === 1);
}

// ── 5) 카카오 연동 시작 Server Action을 조작해 보냄 → 이동할 주소 없음, 연동 행 1개 그대로 ──
// 화면의 [네이버 연동하기]는 키가 없어 비활성이다. 비활성을 풀고 눌러 실제 요청을 잡은 뒤 인자를 kakao로 바꾼다
{
  const before = await one("SELECT count(*)::int AS c FROM accounts WHERE user_id = $1", [await userId()]);
  const naverBtn = row(page, "naver").getByRole("button", { name: "네이버 연동하기" });
  const link = await captureAction(page, async () => {
    await naverBtn.evaluate((b) => b.removeAttribute("disabled"));
    await naverBtn.click({ force: true });
  });
  await page.waitForTimeout(1000);
  check("5 준비: 연동 시작 요청을 잡음", Boolean(link.id) && link.body.includes("naver"), link.body);
  check("5 키 없는 서비스(네이버) 연동 시작 → 이동 없음", new URL(page.url()).pathname === "/settings/account" && !SOCIAL_KEYS.includes("NAVER"), page.url());
  const r = await sendAction(page, link, ["kakao"]);
  check("5 이미 연동한 카카오 연동 시작 → 이동할 주소 없음", r.status === 200 && r.redirect === "", JSON.stringify(r));
  const r2 = await sendAction(page, link, ["credential"]);
  check("5 credential 연동 시작 → 이동할 주소 없음", r2.status === 200 && r2.redirect === "", JSON.stringify(r2));
  const after = await one("SELECT count(*)::int AS c FROM accounts WHERE user_id = $1", [await userId()]);
  check("5 연동 행 수 그대로 (카카오 1개)", before.c === after.c && (await rows("kakao")) === 1, `${before.c} → ${after.c}`);
}

// ── 6) DB에 같은 회원의 카카오 행을 하나 더 → UNIQUE 위반 ──
{
  const err = await insertSocial("kakao", `kakao-other-${n}`).then(() => null, (e) => e);
  check("6 같은 회원 카카오 행 추가 → UNIQUE 거부", err?.code === "23505" && err?.constraint === "accounts_user_provider_uq", err?.constraint ?? "들어감");
}

// ── 9) /settings/account?linked=kakao: 연동 행이 있으면 성공 문구, 없으면 없음 (7번 해제 전후로 확인) ──
{
  await accountPage(page, "?linked=kakao");
  check("9 ?linked=kakao (연동 행 있음) → `카카오 계정을 연동했어요`", await page.getByText("카카오 계정을 연동했어요").isVisible());
  await accountPage(page, "?linked=naver");
  check("9 ?linked=naver (연동 행 없음) → 성공 문구 없음", (await page.getByText("계정을 연동했어요").count()) === 0);
}

// ── 7) [연동 해제] → 확인 창 → 카카오 행 삭제, [카카오 연동하기]로 바뀜 ──
let unlink;
{
  await accountPage(page);
  let dialog = "";
  page.once("dialog", (d) => {
    dialog = d.message();
    d.accept();
  });
  unlink = await captureAction(page, () => row(page, "kakao").getByRole("button", { name: "연동 해제" }).click());
  await row(page, "kakao").getByRole("button", { name: "카카오 연동하기" }).waitFor({ timeout: 10000 }).catch(() => {});
  check("7 확인 창 문구", dialog === "카카오 연동을 해제할까요? 아이디 로그인은 그대로 쓸 수 있어요", dialog);
  check("7 카카오 행 삭제", (await rows("kakao")) === 0);
  check("7 그 줄이 [카카오 연동하기]", (await row(page, "kakao").getByRole("button", { name: "카카오 연동하기" }).count()) === 1);
  check("7 credential 행 그대로", (await rows("credential")) === 1);

  // 확인 창에서 [취소]하면 아무것도 지우지 않는다
  await insertSocial("google");
  await accountPage(page);
  page.once("dialog", (d) => d.dismiss());
  await row(page, "google").getByRole("button", { name: "연동 해제" }).click();
  await page.waitForTimeout(1000);
  check("7 확인 창 [취소] → Google 행 그대로", (await rows("google")) === 1);
}

// ── 8) 해제 Server Action에 credential·목록 밖 값을 넣어 보냄 → credential 행 그대로, 아이디 로그인 됨 ──
{
  for (const arg of ["credential", "CREDENTIAL", "", "github"]) {
    const r = await sendAction(page, unlink, [arg]);
    check(`8 해제 조작 "${arg}" → 오류 없이 무시`, r.status === 200, JSON.stringify(r));
  }
  check("8 credential 행 그대로", (await rows("credential")) === 1);
  check("8 Google 행 그대로 (다른 서비스는 안 지움)", (await rows("google")) === 1);
  const other = await fresh();
  await other.page.goto(BASE);
  await other.page.getByLabel("아이디").fill(ID);
  await other.page.getByLabel("비밀번호", { exact: true }).fill(PW);
  await other.page.getByRole("button", { name: "로그인", exact: true }).click();
  const ok = await other.page.waitForURL(/\/town/, { timeout: 20000 }).then(() => true, () => false);
  check("8 아이디 로그인 됨", ok);
  await other.ctx.close();
}

// ── 9-2) 해제한 뒤 ?linked=kakao → 성공 문구 없음 (주소를 손으로 만든 경우) ──
{
  await accountPage(page, "?linked=kakao");
  check("9 ?linked=kakao (연동 행 없음) → 성공 문구 없음", (await page.getByText("카카오 계정을 연동했어요").count()) === 0);
}

// ── 10) ?provider=kakao&error=<다른 회원 연동 코드> → 문구. 취소 코드는 문구 없음 ──
{
  await accountPage(page, "?provider=kakao&error=account_already_linked_to_different_user");
  check("10 다른 회원 연동 → `이미 다른 Blogville 계정에 연동된 카카오 계정이에요`",
    await page.getByText("이미 다른 Blogville 계정에 연동된 카카오 계정이에요").isVisible());
  await page.screenshot({ path: `${outDir}/81-account-linked-elsewhere.png`, fullPage: true });
  await accountPage(page, "?provider=google&error=access_denied");
  check("10 취소(access_denied) → 문구 없음", (await page.locator('[role="alert"], [role="status"]').filter({ hasText: /연동/ }).count()) === 0);
}

check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
await ctx.close();

// ── 11) 375px: 가로 스크롤 없음, 버튼·링크 누르는 영역 44px 이상, 버튼 글자 한 줄 ──
{
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await loginDev(mp, ID, "남자 주민", PW);
  await accountPage(mp);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("11 375px 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
  const small = await mp.locator("main button, main a, header a[href='/settings/account']").evaluateAll((els) =>
    els
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ t: e.textContent.trim() || e.getAttribute("aria-label"), r: e.getBoundingClientRect(), lh: parseFloat(getComputedStyle(e).lineHeight) }))
      .filter(({ r, lh, t }) => r.height < 44 || r.width < 44 || (t && r.height > 44 && r.height > lh * 2 + 24))
      .map(({ t, r }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  check("11 버튼·링크 44px 이상, 글자 한 줄", small.length === 0, small.join(", "));
  await mp.screenshot({ path: `${outDir}/82-account-375.png`, fullPage: true });
  await m.close();
}

// ══ 회원 탈퇴 (quickstart 4.5의 12~20번) ══
// 탈퇴할 회원 W, 글 주인 A(위의 ID), 다른 회원 B. 글·댓글·공감 등은 DB에 직접 넣는다 (화면 흐름은 blog.mjs가 확인한다).
// 지금 스키마는 답글 = comments.parent_id다. social 5단계가 답글을 replies 표로 나누고 comments.author_id를 SET NULL로 바꾸면
// 12번 준비와 18번 기대를 그 구조로 고친다 (TODO(004-social T046), src/server/account.ts removeAuthorComments).
const W = `wd${n}`;
const WPW = "withdraw-pass-1234";
const B = `wb${n}`;
const W_TEXT = { lone: `W 답글 없는 댓글 ${n}`, reply: `W가 B 댓글에 단 답글 ${n}`, parent: `W 댓글 남의 답글 2개 ${n}` };
const repliesTable = (await one("SELECT to_regclass('public.replies') IS NOT NULL AS ok")).ok;
const notificationsTable = (await one("SELECT to_regclass('public.notifications') IS NOT NULL AS ok")).ok;
const authorNullable = (await one(
  "SELECT is_nullable = 'YES' AS ok FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'author_id'",
)).ok;

/** W에 딸린 행 수 (15번 표). 글·블로그는 W가 가진 것, 공감·이웃은 양쪽 */
async function wCounts(wId, wPostId) {
  const q = async (sql, params) => (await one(sql, params)).c;
  const c = {
    회원: await q("SELECT count(*)::int AS c FROM users WHERE id = $1", [wId]),
    로그인수단: await q("SELECT count(*)::int AS c FROM accounts WHERE user_id = $1", [wId]),
    세션: await q("SELECT count(*)::int AS c FROM sessions WHERE user_id = $1", [wId]),
    프로필: await q("SELECT count(*)::int AS c FROM profiles WHERE user_id = $1", [wId]),
    블로그: await q("SELECT count(*)::int AS c FROM blogs WHERE owner_id = $1", [wId]),
    글: await q("SELECT count(*)::int AS c FROM posts WHERE id = $1", [wPostId]),
    원장: await q("SELECT count(*)::int AS c FROM point_ledger WHERE user_id = $1", [wId]),
    보유아이템: await q("SELECT count(*)::int AS c FROM user_items WHERE user_id = $1", [wId]),
    출석: await q("SELECT count(*)::int AS c FROM attendances WHERE user_id = $1", [wId]),
    이웃: await q("SELECT count(*)::int AS c FROM follows WHERE follower_id = $1 OR followee_id = $1", [wId]),
    공감: await q("SELECT count(*)::int AS c FROM post_likes WHERE user_id = $1 OR post_id = $2", [wId, wPostId]),
    첨부: await q("SELECT count(*)::int AS c FROM attachments WHERE user_id = $1", [wId]),
    댓글: await q("SELECT count(*)::int AS c FROM comments WHERE author_id = $1 OR post_id = $2", [wId, wPostId]),
    실패기록: await q("SELECT count(*)::int AS c FROM login_attempts WHERE username = $1", [W]),
  };
  if (notificationsTable) {
    // TODO(005-game): 칸 이름은 game data-model 2.4 기준(받는 회원 user_id, 행동한 회원 actor_id). game이 표를 만들면 맞춘다
    c.알림 = await q("SELECT count(*)::int AS c FROM notifications WHERE user_id = $1 OR actor_id = $1", [wId]).catch(() => -1);
  }
  return c;
}

let wId;
let wPostId;
let aPostId;
let wCommentIds = {};
// ── 12) 탈퇴할 회원 W 준비 ──
{
  const prep = await fresh();
  await loginDev(prep.page, B, "여자 주민");
  await prep.ctx.close();
  const w = await fresh();
  await loginDev(w.page, W, "남자 주민", WPW);
  await w.ctx.close();

  wId = (await one("SELECT id FROM users WHERE username = $1", [W])).id;
  const aId = await userId();
  const bId = (await one("SELECT id FROM users WHERE username = $1", [B])).id;
  const blogOf = async (uid) => (await one("SELECT id FROM blogs WHERE owner_id = $1", [uid])).id;
  const insertPost = async (uid, title) =>
    (await one("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, $2, '<p>본문</p>', '본문') RETURNING id", [await blogOf(uid), title])).id;
  const insertComment = async (postId, uid, content, parentId = null) =>
    (await one("INSERT INTO comments (post_id, author_id, parent_id, content) VALUES ($1, $2, $3, $4) RETURNING id", [postId, uid, parentId, content])).id;

  wPostId = await insertPost(wId, `W의 글 ${n}`);
  aPostId = await insertPost(aId, `A의 글 ${n}`);
  // A의 글: W 답글 없는 댓글, B 댓글에 W 답글, W 댓글 + B·A 답글 2개
  wCommentIds.lone = await insertComment(aPostId, wId, W_TEXT.lone);
  const bComment = await insertComment(aPostId, bId, `B 댓글 ${n}`);
  wCommentIds.reply = await insertComment(aPostId, wId, W_TEXT.reply, bComment);
  wCommentIds.parent = await insertComment(aPostId, wId, W_TEXT.parent);
  await insertComment(aPostId, bId, `B 답글 1 ${n}`, wCommentIds.parent);
  await insertComment(aPostId, aId, `A 답글 2 ${n}`, wCommentIds.parent);
  // 다른 회원이 W 글에 단 댓글·공감, W가 한 공감, 이웃 양쪽, 첨부 행, 연동 행, 출석(없으면). 실패 기록은 W가 로그인한 뒤에 넣는다
  await insertComment(wPostId, bId, `B가 W 글에 단 댓글 ${n}`);
  await db.query("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2), ($3, $4)", [wPostId, bId, aPostId, wId]);
  await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2), ($3, $1)", [wId, aId, bId]);
  await db.query("INSERT INTO attachments (key, user_id, kind, name, mime, size) VALUES ($1, $2, 'file', 'w.txt', 'text/plain', 1)", [
    randomUUID().replaceAll("-", ""),
    wId,
  ]);
  await db.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, 'kakao', $3)", [randomUUID(), wId, `kakao-w-${n}`]);
  await db.query(
    "INSERT INTO attendances (user_id, date, streak) VALUES ($1, (now() AT TIME ZONE 'Asia/Seoul')::date, 1) ON CONFLICT DO NOTHING",
    [wId],
  );
  const c = await wCounts(wId, wPostId);
  const empty = Object.entries(c).filter(([k, v]) => v <= 0 && k !== "세션" && k !== "실패기록").map(([k]) => k);
  check("12 준비: W의 회원·로그인 수단·프로필·블로그·글·원장·아이템·출석·이웃(양쪽)·공감·첨부·댓글 행 있음", empty.length === 0, empty.join(", ") || JSON.stringify(c));
  if (repliesTable || authorNullable) results.push("⏸️ 12·18 social 구조(replies 표·author_id NULL)가 생겼다. 준비·기대를 그 구조로 고쳐야 한다 (TODO 004-social T046)");
}

const wc = await fresh();
await loginDev(wc.page, W, "남자 주민", WPW);
// 로그인 성공이 실패 기록을 지우므로 로그인한 뒤에 넣는다 (다른 기기에서 W 아이디로 틀린 시도가 있었던 상태)
await db.query("INSERT INTO login_attempts (username, failed_count) VALUES ($1, 1) ON CONFLICT (username) DO NOTHING", [W]);
check("12 준비: W 아이디 실패 기록 1행, 이웃 양쪽 2행", (await wCounts(wId, wPostId)).실패기록 === 1 && (await wCounts(wId, wPostId)).이웃 === 2);
const sessionCookie = async () => (await wc.ctx.cookies()).filter((c) => c.name.includes("session_token")).length;

// ── 13) 빈 칸·틀린 비밀번호로 탈퇴 → 거부 문구, W에 딸린 행 수 그대로 ──
{
  await accountPage(wc.page);
  await wc.page.getByRole("heading", { name: "회원 탈퇴" }).waitFor();
  const before = await wCounts(wId, wPostId);
  const form = wc.page.locator('section[data-section="withdraw"]');
  await form.getByRole("button", { name: "회원 탈퇴" }).click();
  await form.getByText("비밀번호를 적어 주세요").waitFor({ timeout: 10000 }).catch(() => {});
  check("13 빈 칸 → `비밀번호를 적어 주세요`", await form.getByText("비밀번호를 적어 주세요").isVisible());
  await form.getByLabel("비밀번호").fill("wrong-pass-0000");
  await form.getByRole("button", { name: "회원 탈퇴" }).click();
  await form.getByText("비밀번호가 맞지 않아요").waitFor({ timeout: 10000 }).catch(() => {});
  check("13 틀린 비밀번호 → `비밀번호가 맞지 않아요`", await form.getByText("비밀번호가 맞지 않아요").isVisible());
  check("13 거부 뒤 비밀번호 칸 비움", (await form.getByLabel("비밀번호").inputValue()) === "");
  const after = await wCounts(wId, wPostId);
  check("13 W에 딸린 행 수 그대로", JSON.stringify(before) === JSON.stringify(after), JSON.stringify(after));
  await wc.page.screenshot({ path: `${outDir}/83-account-withdraw-wrong.png`, fullPage: true });
}

// ── 14) 맞는 비밀번호로 탈퇴 → 처리 중 비활성 → 로그아웃되어 / ──
{
  const form = wc.page.locator('section[data-section="withdraw"]');
  await form.getByLabel("비밀번호").fill(WPW);
  const btn = form.getByRole("button", { name: /회원 탈퇴|탈퇴하는 중/ });
  await btn.click();
  const pendingDisabled = await form
    .getByRole("button", { name: "탈퇴하는 중..." })
    .evaluate((b) => b.disabled, null, { timeout: 2000 })
    .catch(() => null);
  await wc.page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 20000 }).catch(() => {});
  check("14 맞는 비밀번호 → `/`", new URL(wc.page.url()).pathname === "/", wc.page.url());
  if (pendingDisabled !== null) check("14 처리 중 버튼 비활성", pendingDisabled === true);
  check("14 세션 쿠키 지워짐", (await sessionCookie()) === 0);
  await wc.page.getByLabel("아이디").waitFor({ timeout: 10000 }).catch(() => {});
  check("14 첫 화면 로그인 폼", await wc.page.getByLabel("아이디").isVisible());
}
check("탈퇴 화면 콘솔 오류 없음", wc.errors.length === 0, wc.errors.join(" | "));
await wc.ctx.close();

// ── 15) DB: W에 딸린 행 모두 0 ──
{
  const c = await wCounts(wId, wPostId);
  const left = Object.entries(c).filter(([, v]) => v !== 0).map(([k, v]) => `${k} ${v}`);
  check("15 W의 회원·로그인 수단·세션·프로필·블로그·글·원장·아이템·출석·이웃·공감·첨부·댓글·실패 기록 0행", left.length === 0, left.join(", "));
  if (!notificationsTable) results.push("⏸️ 15 알림 0행: notifications 표가 아직 없다 (game 6단계, TODO 005-game)");
}

// ── 16) W 아이디로 로그인 → `아이디 또는 비밀번호가 맞지 않아요` ──
{
  const { ctx: c, page: p } = await fresh();
  await p.goto(BASE);
  await p.getByLabel("아이디").fill(W);
  await p.getByLabel("비밀번호", { exact: true }).fill(WPW);
  await p.getByRole("button", { name: "로그인", exact: true }).click();
  await p.getByText("아이디 또는 비밀번호가 맞지 않아요").waitFor({ timeout: 10000 }).catch(() => {});
  check("16 W 로그인 → `아이디 또는 비밀번호가 맞지 않아요`", await p.getByText("아이디 또는 비밀번호가 맞지 않아요").isVisible());

  // ── 17) /@{W 주소} → 404 ──
  const res = await p.goto(`${BASE}/@${W}`);
  check("17 /@{W 주소} → 404 `길을 잃었어요`", res?.status() === 404 && (await p.getByText("길을 잃었어요").isVisible()), String(res?.status()));

  // ── 18) A의 글 화면: W 댓글·답글 사라짐 ──
  await p.goto(`${BASE}/@${ID}/${aPostId}`);
  await p.getByRole("region", { name: "댓글" }).waitFor({ timeout: 10000 }).catch(() => {});
  const comments = await p.getByRole("region", { name: "댓글" }).innerText().catch(() => "");
  check("18 답글 없던 W 댓글 → 자리 없이 사라짐", !comments.includes(W_TEXT.lone));
  check("18 B 댓글에 단 W 답글 → 자리 없이 사라짐, B 댓글은 그대로", !comments.includes(W_TEXT.reply) && comments.includes(`B 댓글 ${n}`));
  check("18 남의 답글이 달린 W 댓글 원문 없음", !comments.includes(W_TEXT.parent));
  if (repliesTable || authorNullable) {
    const placeholder = await p.getByText("삭제된 댓글이에요").count();
    check("18 그 자리에 `삭제된 댓글이에요`, 남의 답글 2개 그대로",
      placeholder >= 1 && comments.includes(`B 답글 1 ${n}`) && comments.includes(`A 답글 2 ${n}`), comments.slice(0, 300));
  } else {
    const kept = Number(comments.includes(`B 답글 1 ${n}`)) + Number(comments.includes(`A 답글 2 ${n}`));
    results.push(
      `⏸️ 18 \`삭제된 댓글이에요\` 자리와 남의 답글 2개 유지: 지금 스키마(답글 = comments.parent_id, author_id CASCADE)로는 불가. ` +
        `social 5단계 뒤 확인 (TODO 004-social T046). 지금 남은 남의 답글 ${kept}개`,
    );
  }
  await p.screenshot({ path: `${outDir}/84-account-withdrawn-comments.png`, fullPage: true });

  // ── 19) 그 글의 HTML·RSC 응답 본문에 W 닉네임·원문 0건 ──
  const html = await (await p.request.get(`${BASE}/@${ID}/${aPostId}`)).text();
  const rsc = await (await p.request.get(`${BASE}/@${ID}/${aPostId}`, { headers: { RSC: "1" } })).text();
  const leaks = [W, ...Object.values(W_TEXT)].filter((t) => html.includes(t) || rsc.includes(t));
  check("19 HTML·RSC 응답에 W 닉네임·댓글·답글 원문 0건", leaks.length === 0 && html.length > 0 && rsc.length > 0, leaks.join(", "));
  await c.close();
}

// ── 20) 같은 아이디로 다시 가입 → 가입됨 ──
{
  const { ctx: c, page: p } = await fresh();
  await loginDev(p, W, "여자 주민", WPW);
  check("20 같은 아이디로 다시 가입", /\/town/.test(p.url()) && (await one("SELECT count(*)::int AS c FROM users WHERE username = $1", [W])).c === 1, p.url());
  await c.close();
}

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exitCode = 1;
