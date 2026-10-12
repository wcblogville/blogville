// 교류: 마을 소식(SOC-05)·공감(SOC-03)·이웃(SOC-04) (US1, US3, US4 / SC-002·003·005·009, quickstart 4.2~4.4)
// 사용: 개발 서버를 띄운 상태에서 node e2e/social.mjs <스크린샷 폴더>
// 실행마다 새 회원을 만들고, 글은 DB로 준비한다. 마을 소식 첫 장에 오도록 넣은 글은 끝에 지운다
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const count = async (q, p) => (await one(q, p)).n;

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const n = Date.now() % 100_000_000;

async function member(id) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await loginDev(page, id);
  return { ctx, page, errors };
}
const userId = async (username) => (await one("SELECT id FROM users WHERE username = $1", [username])).id;
const blogOf = async (username) => (await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [username])).id;
/** ago: SQL interval 문자열 ("3 days") 또는 미래로 보내는 "-1 day" */
const newPost = async (username, title, { visibility = "public", ago = "0 seconds" } = {}) =>
  (
    await one(
      "INSERT INTO posts (blog_id, title, content_html, content_text, visibility, created_at, updated_at) VALUES ($1, $2, '<p>x</p>', 'x', $3, now() - $4::interval, now() - $4::interval) RETURNING id",
      [await blogOf(username), title, visibility, ago],
    )
  ).id;
const titles = async (page) => page.locator("article h3").allInnerTexts();

// ══ US1 마을 소식 ══
// [🏘 마을 전체] = ⭐ 즐겨찾는 이웃의 글만, [💛 이웃 새 글] = 모든 이웃의 글. 모르는 사람·내 글·공지 블로그 글은 없다 (사용자 요청 2026-10-12)
const F = `scf${n}`; // R의 즐겨찾는 이웃
const S = `scs${n}`; // R이 모르는 사람
const N = `scn${n}`; // R의 이웃 (즐겨찾기 아님)
const R = await member(`scr${n}`);
await member(F);
await member(S);
await member(N);
// 마을 소식 첫 장에 오도록 미래 시각으로 넣는다 (다른 시험의 글보다 위, 끝에 지움)
const fPosts = [];
for (let i = 1; i <= 9; i++) fPosts.push(await newPost(F, `F 공개 ${i}`, { ago: `${-(86400 * 365 + i * 60)} seconds` }));
await newPost(F, "F 비공개", { visibility: "private", ago: `${-(86400 * 365 + 10 * 60)} seconds` });
// 모르는 사람·이웃·나의 글은 F 글보다 더 새 글이라 섞여 들어오면 맨 위에 보인다
const strangerPost = await newPost(S, "S 모르는 사람 글", { ago: `${-(86400 * 366)} seconds` });
const neighborPost = await newPost(N, "N 이웃 글", { ago: `${-(86400 * 366 + 60)} seconds` });
const ownPost = await newPost(`scr${n}`, "R 내 글", { ago: `${-(86400 * 366 + 120)} seconds` });
const uidR = await userId(`scr${n}`);
const adminId = (await one("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1"))?.id;
await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, true), ($1, $3, false)", [uidR, await userId(F), await userId(N)]);
// 예전에 켜 둔 공지 블로그 ⭐ (지금 화면에서는 못 켠다)도 목록에 공지 글을 넣지 않는다
if (adminId) await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, true)", [uidR, adminId]);
const notice = await one(
  `SELECT p.id, p.title, b.slug FROM posts p JOIN blogs b ON b.id = p.blog_id JOIN users u ON u.id = b.owner_id AND u.role = 'admin'
     JOIN categories c ON c.id = p.category_id AND c.name = '공지' WHERE p.visibility = 'public' ORDER BY p.created_at DESC, p.id DESC LIMIT 1`,
);
check("공지: 시드가 넣은 공지 글이 있음 (db:seed·admin:create)", Boolean(notice), notice?.title);

const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const guest = await guestCtx.newPage();
const guestErrors = collectErrors(guest);
await guest.goto(`${BASE}/feed`);
check("US1-1 방문자 탭 제목 `마을 소식 | Blogville`", (await guest.title()) === "마을 소식 | Blogville", await guest.title());
check("US1-1 방문자 [🏘 마을 전체]만, [💛 이웃 새 글] 없음",
  (await guest.getByRole("link", { name: "마을 전체", exact: true }).count()) === 1 && (await guest.getByRole("link", { name: "이웃 새 글", exact: true }).count()) === 0);
check("US1-1 방문자: 글 목록 없음(모르는 사람 글 0)·로그인 안내", (await titles(guest)).length === 0 && (await guest.getByText("로그인하면 즐겨찾기한 이웃의 새 글을").isVisible()));
const pinned = guest.locator("[data-pinned-notice]");
check("공지: 방문자도 맨 위 공지 카드·제목", (await pinned.count()) === 1 && (await pinned.getByRole("heading").innerText()) === notice?.title);
check("공지: [📖 전체 읽기] → 공지 글", (await pinned.getByRole("link", { name: /전체 읽기/ }).getAttribute("href")) === `/@${notice?.slug}/${notice?.id}`);

const r = R.page;
await r.goto(`${BASE}/feed`);
const first = await titles(r);
const want = Array.from({ length: 8 }, (_, i) => `F 공개 ${9 - i}`);
check("US1-2 마을 전체: 즐겨찾는 이웃 F의 공개 글만 8개 최신순", first.join() === want.join(), first.join());
check("US1-2 마을 전체: 모르는 사람·즐겨찾기 아닌 이웃·내 글·공지 블로그 글 없음",
  ["S 모르는 사람 글", "N 이웃 글", "R 내 글", notice?.title].every((t) => !first.includes(t)) &&
  (await r.locator(`article a[href$="/${strangerPost}"], article a[href$="/${neighborPost}"], article a[href$="/${ownPost}"]`).count()) === 0);
check("US1-2 비공개 배지 없음", (await r.getByText("비공개", { exact: true }).count()) === 0);
const order = await r.evaluate(() => {
  const main = document.querySelector("main") ?? document.body;
  const at = (el) => (el ? el.getBoundingClientRect().top : Infinity);
  return { notice: at(main.querySelector("[data-pinned-notice]")), tabs: at(main.querySelector('a.pixel-tab[href="/feed"]')), firstCard: at(main.querySelector("article")) };
});
check("공지: 탭·글 목록보다 위에 고정", order.notice < order.tabs && order.notice < order.firstCard, JSON.stringify(order));
await r.goto(`${BASE}/feed?page=2`);
check("US1-2 9번째는 2페이지 맨 위·공지는 2쪽에도 맨 위", (await titles(r))[0] === "F 공개 1" && (await r.locator("[data-pinned-notice]").count()) === 1);
await r.goto(`${BASE}/feed`);
const card = r.locator("article").first();
const authorHref = await card.locator('a[href^="/@"]').first().getAttribute("href");
check("US1-3 카드 작성자 줄 → 블로그 홈", authorHref === `/@${F}`, authorHref);
await card.locator("h3").click();
await r.waitForURL(new RegExp(`/@${F}/${fPosts[8]}$`));
check("US1-3 카드 클릭 1번 → 글 상세 (SC-008)", true);
await r.goto(`${BASE}/feed?page=999`);
check("US1-5 빈 쪽 문구 (즐겨찾기 안내)", await r.getByText("즐겨찾기한 이웃의 새 글이 아직 없어요.").isVisible());
// 페이지 번호 줄만 본다: 마을 소식 탭([🏘 마을 전체])도 지금 탭이라 aria-current="page"를 단다 (도트 탭, 2026-10-12)
check("US1-5 빈 쪽 현재 페이지 표시 없음", (await r.locator('nav[aria-label="페이지"] [aria-current="page"]').count()) === 0);
// 이웃 새 글: 즐겨찾기 F + 이웃 N, 모르는 사람 S·내 글·공지 블로그는 없음
await r.goto(`${BASE}/feed/following`);
const all = [];
for (let pg = 1; pg <= 3; pg++) {
  await r.goto(`${BASE}/feed/following?page=${pg}`);
  all.push(...(await titles(r)));
}
check("US1-4 이웃 새 글: 즐겨찾기 F 글 + 이웃 N 글", all.includes("N 이웃 글") && fPosts.length === all.filter((t) => t.startsWith("F 공개")).length, all.join());
check("US1-4 이웃 새 글: 모르는 사람·내 글·공지 블로그 글 없음", ["S 모르는 사람 글", "R 내 글", notice?.title].every((t) => !all.includes(t)));
await r.goto(`${BASE}/feed/following`);
check("공지: 이웃 새 글에도 맨 위 공지", (await r.locator("[data-pinned-notice]").count()) === 1);
await guest.goto(`${BASE}/feed`);
const tagLinks = await guest.locator('a[href^="/tags/"]').count();
check("US1-6 인기 태그 최대 30개·태그 목록 링크", tagLinks <= 30);
// 375px: 가로 스크롤 0, 인기 태그 칸이 목록 아래
await r.setViewportSize({ width: 375, height: 800 });
await r.goto(`${BASE}/feed`);
const overflow = await r.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("US1-8 375px 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
const lastCard = await r.locator("article").last().boundingBox();
const tagBox = await r.getByRole("heading", { name: "인기 태그" }).boundingBox();
check("US1-8 375px 인기 태그 칸이 목록 아래", tagBox.y > lastCard.y);
const nb = await r.locator("[data-pinned-notice]").boundingBox();
check("공지: 375px 화면 너비 안", nb && nb.x >= 0 && nb.x + nb.width <= 375, nb && `${Math.round(nb.x)}+${Math.round(nb.width)}`);
await r.screenshot({ path: `${outDir}/social-feed-375.png`, fullPage: true });
await r.setViewportSize({ width: 1280, height: 900 });
await db.query("DELETE FROM follows WHERE follower_id = $1", [uidR]);
await db.query("DELETE FROM posts WHERE id = ANY($1)", [[strangerPost, neighborPost, ownPost]]);

// ══ 릴리스 노트 (사용자 요청 2026-10-12): 공지 블로그 "릴리스 노트" 분류 공개 글, 최신순. 시드 글 + 관리자가 직접 쓴 글 ══
{
  const adminBlog = (await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id AND u.role = 'admin' ORDER BY u.created_at LIMIT 1"))?.id;
  const cat = async (name) => (await one("SELECT id FROM categories WHERE blog_id = $1 AND name = $2", [adminBlog, name]))?.id ?? null;
  const releaseCat = await cat("릴리스 노트");
  check("릴리스 노트: 시드가 분류와 v0.1~ 글을 넣음", Boolean(releaseCat) &&
    (await count("SELECT count(*)::int AS n FROM posts WHERE category_id = $1 AND title LIKE 'v0.%'", [releaseCat])) >= 4);
  const adminPost = async (title, categoryId, ago = "0 seconds", visibility = "public") =>
    (await one(
      "INSERT INTO posts (blog_id, category_id, title, content_html, content_text, visibility, created_at, updated_at) VALUES ($1, $2, $3, '<p>x</p>', 'x', $4, now() - $5::interval, now()) RETURNING id",
      [adminBlog, categoryId, title, visibility, ago],
    )).id;
  const hand = await adminPost(`손으로 쓴 릴리스 노트 ${n}`, releaseCat);
  const handPrivate = await adminPost(`비공개 릴리스 노트 ${n}`, releaseCat, "0 seconds", "private");
  const otherCat = await adminPost(`공지 분류 옛 글 ${n}`, await cat("공지"), "400 days");
  const noCat = await adminPost(`분류 없는 관리자 글 ${n}`, null);
  await guest.goto(`${BASE}/feed/releases`);
  const rel = await titles(guest);
  check("릴리스 노트: 방문자도 탭·탭 제목", (await guest.getByRole("link", { name: "릴리스 노트", exact: true }).getAttribute("aria-current")) === "page" && (await guest.title()) === "릴리스 노트 | Blogville", await guest.title());
  check("릴리스 노트: 관리자가 그 분류로 직접 쓴 글이 맨 위", rel[0] === `손으로 쓴 릴리스 노트 ${n}`, rel.join());
  const vs = rel.filter((t) => /^v\d/.test(t)).map((t) => t.split(" ")[0]);
  // 버전이 늘면 v0.1이 2쪽으로 넘어가므로 순서만 본다 (v0.11 > v0.7: 숫자로 비교)
  const num = (v) => v.slice(1).split(".").map(Number);
  const desc = [...vs].sort((a, b) => num(b)[0] - num(a)[0] || num(b)[1] - num(a)[1]);
  // 맨 앞은 src/content/release-notes.ts의 마지막(가장 새) 버전 (버전이 늘어 v0.4가 첫 장에서 밀려나도 맞게)
  const newest = [...readFileSync("src/content/release-notes.ts", "utf8").matchAll(/version: "(v[\d.]+)"/g)].at(-1)?.[1];
  check("릴리스 노트: 시드 버전 최신순", vs.length >= 4 && vs.join() === desc.join() && vs[0] === newest, `${vs.join()} (최신 ${newest})`);
  check("릴리스 노트: 비공개·다른 분류·분류 없는 관리자 글은 없음",
    [`비공개 릴리스 노트 ${n}`, `공지 분류 옛 글 ${n}`, `분류 없는 관리자 글 ${n}`, notice?.title].every((t) => !rel.includes(t)));
  check("릴리스 노트: 맨 위 공지 카드도 걸림", (await guest.locator("[data-pinned-notice]").count()) === 1);
  check("릴리스 노트: 사용법 공지는 그대로 (옛 공지 분류 글이 밀어내지 않음)", (await guest.locator("[data-pinned-notice] h2").innerText()) === notice?.title);
  await guest.screenshot({ path: `${outDir}/feed-releases-1280.png`, fullPage: true });
  await guest.setViewportSize({ width: 375, height: 800 });
  await guest.goto(`${BASE}/feed/releases`);
  const ovr = await guest.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("릴리스 노트: 375px 가로 스크롤 없음", ovr <= 0, `${ovr}px`);
  await guest.screenshot({ path: `${outDir}/feed-releases-375.png`, fullPage: true });
  await guest.setViewportSize({ width: 1280, height: 900 });
  await r.goto(`${BASE}/feed`);
  check("릴리스 노트: 회원 마을 소식에 네 탭 (🌐 모든 글 1.37)", (await r.locator("a.pixel-tab").allInnerTexts()).join() === "마을 전체,이웃 새 글,모든 글,릴리스 노트");
  await db.query("DELETE FROM posts WHERE id = ANY($1)", [[hand, handPrivate, otherCat, noCat]]);
}

// ══ US3 공감 ══
const G = await member(`scg${n}`);
const H = `sch${n}`;
await member(H);
const uidG = await userId(`scg${n}`);
const uidH = await userId(H);
const LP = await newPost(H, "공감 받을 글");
const likeRows = async () => count("SELECT count(*)::int AS n FROM post_likes WHERE post_id = $1", [LP]);
const likeLedger = async () => count("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'like_received' AND ref_id = $2", [uidH, `${LP}:${uidG}`]);
const likeBtn = (page) => page.getByRole("button", { name: /공감 \d+/ });
/** 공감 버튼을 누르고 서버 처리 응답까지 기다린다 */
async function clickLike(page) {
  const done = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
  await likeBtn(page).click();
  await done;
  await page.waitForLoadState("networkidle");
}
const hCoins = async () => count("SELECT COALESCE(SUM(coin_delta), 0)::int AS n FROM point_ledger WHERE user_id = $1", [uidH]);

await G.page.goto(`${BASE}/@${H}/${LP}`);
const coinsBefore = await hCoins();
const likeReq = G.page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
await likeBtn(G.page).click();
const likeAction = await likeReq;
await G.page.waitForLoadState("networkidle");
check("US3-1 공감 → `♥ 공감 1`·aria-pressed", (await likeBtn(G.page).innerText()) === "공감 1" && (await likeBtn(G.page).getAttribute("aria-pressed")) === "true");
check("US3-1 H 코인 +2", (await hCoins()) === coinsBefore + 2);
// 새로고침 안 한 다른 탭에서 [♡ 공감 0]을 눌러도 서버는 취소로 처리
const tab2 = await G.ctx.newPage();
await tab2.goto(`${BASE}/@${H}/${LP}`);
await clickLike(G.page);
check("US3-2 다시 누르면 `♡ 공감 0`", (await likeBtn(G.page).innerText()) === "공감 0" && (await likeRows()) === 0);
await clickLike(G.page);
check("US3-3 공감 → 취소 → 공감 → 1행·보상 1번", (await likeRows()) === 1 && (await likeLedger()) === 1 && (await hCoins()) === coinsBefore + 2);
await clickLike(tab2); // tab2는 공감 직후 화면(♥ 공감 1)이지만 서버 상태(공감 있음) 기준으로 취소
check("US3-2 다른 탭에서 누르면 서버 상태로 처리(취소)", (await likeRows()) === 0);
// H가 자기 글 공감 → 보상 없음
const Hm = await member(H);
const hBefore = await hCoins();
await Hm.page.goto(`${BASE}/@${H}/${LP}`);
await clickLike(Hm.page);
check("US3-4 자기 글 공감 → 보상 없음", (await hCoins()) === hBefore && (await likeRows()) === 1);
// 방문자: 비활성 + 안내 글자
await guest.goto(`${BASE}/@${H}/${LP}`);
check("US3-5 방문자 버튼 비활성·`로그인하면 공감할 수 있어요` 글자",
  (await likeBtn(guest).isDisabled()) && (await guest.getByText("로그인하면 공감할 수 있어요").isVisible()));
// 동시 요청: 두 요청을 한꺼번에 보내도 1행을 넘지 않고 오류 없음
const fire = (page, args) =>
  page.evaluate(
    async ({ actionId, contentType, body }) =>
      (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType }, body })).status,
    { actionId: likeAction.headers()["next-action"], contentType: likeAction.headers()["content-type"], body: JSON.stringify(args) },
  );
let concurrentOk = true;
const seen = [];
for (let i = 0; i < 10; i++) {
  await db.query("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", [LP, uidG]);
  const statuses = await Promise.all([fire(G.page, [LP]), fire(tab2, [LP])]);
  const rows = await count("SELECT count(*)::int AS n FROM post_likes WHERE post_id = $1 AND user_id = $2", [LP, uidG]);
  seen.push(rows);
  if (rows > 1 || statuses.some((s) => s !== 200)) concurrentOk = false;
}
check("US3-6 동시 공감 10회 → 매번 1행 이하(중복 0)·HTTP 200·오류 없음·보상 1번", concurrentOk && (await likeLedger()) === 1, seen.join(""));
// 조작: 남의 비공개 글·abc·범위 밖 → 저장 0
const secret = await newPost(H, "H 비공개", { visibility: "private" });
const likesBefore = await count("SELECT count(*)::int AS n FROM post_likes");
const st = [await fire(G.page, [secret]), await fire(G.page, ["abc"]), await fire(G.page, [99999999999])];
check("US3-7 비공개 글·abc·범위 밖 공감 → 저장 0·HTTP 200", (await count("SELECT count(*)::int AS n FROM post_likes")) === likesBefore && st.every((s) => s === 200), st.join());
// 카드 ♥ N = 상세 공감 N
await G.page.goto(`${BASE}/@${H}/${LP}`);
const detail = Number((await likeBtn(G.page).innerText()).replace(/\D/g, ""));
await G.page.goto(`${BASE}/@${H}`);
const cardText = await G.page.locator("article", { hasText: "공감 받을 글" }).innerText();
check("US3-8 카드 ♥ N = 상세 공감 N", (await G.page.locator("article", { hasText: "공감 받을 글" }).locator("[data-like-count]").innerText()).trim() === String(detail), `${detail} / ${cardText.replace(/\n/g, " ").slice(0, 80)}`);
const dup = await db.query("INSERT INTO post_likes (post_id, user_id) SELECT post_id, user_id FROM post_likes WHERE post_id = $1 LIMIT 1", [LP]).then(() => "ok").catch((e) => e.code);
check("DB 직접 같은 공감 두 번 → 23505", dup === "23505", dup);
const dupReward = await db
  .query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) VALUES ($1, 'like_received', 2, 2, $2)", [uidH, `${LP}:${uidG}`])
  .then(() => "ok")
  .catch((e) => e.code);
check("DB 직접 같은 공감 보상 두 번 → 23505 (point_ledger_like_received_uq)", dupReward === "23505", dupReward);

// ══ US4 이웃 ══
const X = await member(`scx${n}`);
const uidX = await userId(`scx${n}`);
const Bn = `scb${n}`;
const Cn = `scc${n}`;
await member(Bn);
await member(Cn);
const uidB = await userId(Bn);
const uidC = await userId(Cn);
const bOld = await newPost(Bn, "B 이웃 전 글", { ago: "2 days" });
await newPost(Bn, "B 비공개 글", { visibility: "private", ago: "1 day" });
const followRows = async (followee) => count("SELECT count(*)::int AS n FROM follows WHERE follower_id = $1 AND followee_id = $2", [uidX, followee]);
const ledgerAll = async () => count("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = ANY($1)", [[uidX, uidB]]);

// 이웃 0명 → 두 줄 문구
await X.page.goto(`${BASE}/feed/following`);
check("US4 탭 제목 `이웃 새 글 | Blogville`", (await X.page.title()) === "이웃 새 글 | Blogville");
check("US4-6 이웃 0명 → 두 줄 문구·인기 태그·마을 검색 안내",
  (await X.page.getByText("아직 이웃이 없거나 이웃의 새 글이 없어요.").isVisible()) &&
  (await X.page.getByText("마을 검색에서 마음에 드는 블로그를 찾아").isVisible()));

// 추가 → 버튼·이웃 N
const ledgerBefore = await ledgerAll();
await X.page.goto(`${BASE}/@${Bn}`);
const followersText = async () => (await X.page.getByText(/이웃 \d+/).first().innerText()).match(/이웃 (\d+)/)[1];
const before = Number(await followersText());
const followReq = X.page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
await X.page.getByRole("button", { name: "+ 이웃 추가" }).click();
const followAction = await followReq;
await X.page.getByRole("button", { name: "✓ 이웃" }).waitFor();
check("US4-1 [+ 이웃 추가] → [✓ 이웃]·이웃 +1·확인 창 없음", Number(await followersText()) === before + 1 && (await followRows(uidB)) === 1);
const btnBox = await X.page.getByRole("button", { name: "✓ 이웃" }).boundingBox();
check("US4 이웃 버튼 ≥ 44px", btnBox.height >= 44 && btnBox.width >= 44);
await X.page.goto(`${BASE}/feed/following`);
const followingTitles = await titles(X.page);
check("US4-3 이웃 새 글: B 공개 글(이웃 전 글 포함)만", followingTitles.join() === "B 이웃 전 글", followingTitles.join());
await X.page.goto(`${BASE}/@${Bn}`);
await X.page.getByRole("button", { name: "✓ 이웃" }).click();
await X.page.getByRole("button", { name: "+ 이웃 추가" }).waitFor();
check("US4-2 [✓ 이웃] → 취소·이웃 −1", Number(await followersText()) === before && (await followRows(uidB)) === 0);
await X.page.goto(`${BASE}/feed/following`);
check("US4-4 취소 뒤 B 글 빠짐", (await titles(X.page)).length === 0);
check("US4-9 추가·취소에 보상 없음", (await ledgerAll()) === ledgerBefore);

// 조작 요청: 없는 회원·블로그 없는 회원·숫자·객체·자기 자신 → 0행·HTTP 200
const forgeFollow = (args) =>
  X.page.evaluate(
    async ({ actionId, contentType, body }) =>
      (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType }, body })).status,
    { actionId: followAction.headers()["next-action"], contentType: followAction.headers()["content-type"], body: JSON.stringify(args) },
  );
const noBlogId = `noblog-${n}`;
await db.query("INSERT INTO users (id, name, email, username) VALUES ($1, $1, $2, $1)", [noBlogId, `${noBlogId}@example.com`]).catch(() => {});
const forgeStatuses = [];
for (const arg of ["no-such-user-id", noBlogId, 42, { id: uidB }, uidX, "x".repeat(65)]) forgeStatuses.push(await forgeFollow([arg]));
check("US4-8 없는 회원·블로그 없는 회원·숫자·객체·자기 자신·65자 → 이웃 0·HTTP 200",
  (await count("SELECT count(*)::int AS n FROM follows WHERE follower_id = $1", [uidX])) === 0 && forgeStatuses.every((s) => s === 200), forgeStatuses.join());
await db.query("DELETE FROM users WHERE id = $1", [noBlogId]);
// 동시 추가 2개 → 1행
await Promise.all([forgeFollow([uidB]), forgeFollow([uidB])]);
check("US4-7 같은 대상 동시 추가 → 1행 이하", (await followRows(uidB)) <= 1, String(await followRows(uidB)));
await db.query("DELETE FROM follows WHERE follower_id = $1", [uidX]);
const selfFollow = await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $1)", [uidX]).then(() => "ok").catch((e) => e.code);
check("DB 직접 자기 자신 이웃 → 23514", selfFollow === "23514", selfFollow);
// 내 블로그 홈: 주인 버튼만
await X.page.goto(`${BASE}/@scx${n}`);
check("US4-5 내 블로그 홈 → 주인 도구 막대 [✏️ 새 글 쓰기]·이웃 버튼 없음",
  (await X.page.getByRole("link", { name: "새 글 쓰기" }).isVisible()) && (await X.page.getByRole("button", { name: /이웃/ }).count()) === 0);

// 즐겨찾는 이웃 최근 7일 글이 맨 위 (FR-042)
await db.query("DELETE FROM posts WHERE blog_id = ANY($1)", [[await blogOf(Bn), await blogOf(Cn)]]);
await newPost(Cn, "C 3일 전", { ago: "3 days" });
await newPost(Cn, "C 10일 전", { ago: "10 days" });
await newPost(Bn, "B 어제", { ago: "1 day" });
await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) VALUES ($1, $2, true), ($1, $3, false)", [uidX, uidC, uidB]);
await X.page.goto(`${BASE}/feed/following`);
check("US4-10 즐겨찾기 C(3일 전) → B(어제) → C(10일 전)", (await titles(X.page)).join() === "C 3일 전,B 어제,C 10일 전", (await titles(X.page)).join());
await newPost(Cn, "C 6일 전", { ago: "6 days" });
// 7일 전 = 오늘 포함 7일의 시작(6일 전 0시)보다 앞
await one(`INSERT INTO posts (blog_id, title, content_html, content_text, created_at, updated_at)
  VALUES ($1, 'C 7일 전', '<p>x</p>', 'x', (((now() AT TIME ZONE 'Asia/Seoul')::date - 7)::timestamp + interval '23 hours') AT TIME ZONE 'Asia/Seoul', now()) RETURNING id`, [await blogOf(Cn)]);
await X.page.goto(`${BASE}/feed/following`);
check("US4-11 C 6일 전은 맨 위 묶음, 7일 전은 일반 순서",
  (await titles(X.page)).join() === "C 3일 전,C 6일 전,B 어제,C 7일 전,C 10일 전", (await titles(X.page)).join());
await X.page.goto(`${BASE}/feed/following?page=999`);
check("US4-6 이웃 글 있는 회원 page=999 → 같은 두 줄 문구", await X.page.getByText("아직 이웃이 없거나 이웃의 새 글이 없어요.").isVisible());
// 방문자 /feed/following → /
await guest.goto(`${BASE}/feed/following`);
check("US4 방문자 이웃 새 글 → /", new URL(guest.url()).pathname === "/");
// 375px
await X.page.setViewportSize({ width: 375, height: 800 });
await X.page.goto(`${BASE}/feed/following`);
const ov = await X.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("US4 375px 이웃 새 글 가로 스크롤 없음", ov <= 0, `${ov}px`);
await X.page.screenshot({ path: `${outDir}/social-following-375.png`, fullPage: true });
await X.page.goto(`${BASE}/@${Bn}`);
const ov2 = await X.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const fb = await X.page.getByRole("button", { name: /이웃/ }).boundingBox();
check("US4 375px 블로그 홈 가로 스크롤 없음·이웃 버튼 44px·한 줄", ov2 <= 0 && fb.height >= 44 && fb.height < 60, `${ov2}px ${Math.round(fb.width)}×${Math.round(fb.height)}`);

// 마을 소식 첫 장에 넣은 글 정리
await db.query("DELETE FROM posts WHERE id = ANY($1) OR (blog_id = $2 AND visibility = 'private')", [fPosts, await blogOf(F)]);
void bOld;

const errs = [...guestErrors, ...R.errors, ...G.errors, ...X.errors].filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", errs.length === 0, errs.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
