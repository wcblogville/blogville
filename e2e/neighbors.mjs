// 이웃 목록 + 이웃 추가 알림 (SOC-06, 사용자 요청 2026-10-12 "친구 이웃 볼 수 있게 해서 그거 타고 가서 팔로우 할 수 있게 하자.
// 그리고 누가 팔로우 하면 알림 가게")
// 사용: 개발 서버를 띄운 상태에서 node e2e/neighbors.mjs <스크린샷 폴더>
// 실행마다 새 회원 O(블로그 주인)·P·Q·V(보는 사람)를 만들고, O의 이웃 관계는 pg로 넣어 준비한다
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
const [O, P, Q, V] = ["nbo", "nbp", "nbq", "nbv"].map((p) => `${p}${n}`);
const userId = async (username) => (await one("SELECT id FROM users WHERE username = $1", [username])).id;
const followNotes = (to, from) =>
  count("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND actor_id = $2 AND kind = 'follow'", [to, from]);

async function member(id, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await loginDev(page, id);
  return { ctx, page, errors };
}

// 가입 (P·Q는 가입만)
for (const id of [P, Q]) {
  const m = await member(id);
  await m.ctx.close();
}
const v = await member(V);
const o = await member(O);
const ids = { O: await userId(O), P: await userId(P), Q: await userId(Q), V: await userId(V) };
// O의 이웃: P(먼저)·Q(나중), O를 이웃으로 둔 주민: P (맞이웃)
await db.query(
  `INSERT INTO follows (follower_id, followee_id, created_at) VALUES ($1, $2, now() - interval '1 hour'), ($1, $3, now()), ($2, $1, now())`,
  [ids.O, ids.P, ids.Q],
);

// ── 옆 칸 👫 이웃 위젯 (회원) ──
const page = v.page;
await page.goto(`${BASE}/@${O}`);
const widget = page.locator('[data-widget="neighbors"]');
await widget.waitFor();
check("위젯: 이웃 2 · 나를 이웃으로 둔 주민 1",
  (await widget.locator('[data-neighbor-count="following"]').innerText()) === "2" && (await widget.locator('[data-neighbor-count="followers"]').innerText()) === "1");
const faces = await widget.locator("[data-neighbor-face]").evaluateAll((els) => els.map((e) => e.getAttribute("data-neighbor-face")));
check("위젯: 최근 이웃 얼굴 (최근 순 Q, P)", faces.join() === [Q, P].join(), faces.join());
await widget.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${outDir}/neighbors-widget.png` });

// 이웃 추가 → O에게 알림 (블로그 제목 줄 버튼)
await page.locator("[data-blog-title-bar]").getByRole("button", { name: "+ 이웃 추가" }).click();
await page.locator("[data-blog-title-bar]").getByRole("button", { name: "✓ 이웃" }).waitFor();
check("이웃 추가 → 받는 사람에게 follow 알림 1개", (await followNotes(ids.O, ids.V)) === 1);
check("위젯: 나를 이웃으로 둔 주민 2로 늘어남", (await widget.locator('[data-neighbor-count="followers"]').innerText()) === "2");
// 끊었다가 다시 추가해도 알림은 다시 안 간다
await page.locator("[data-blog-title-bar]").getByRole("button", { name: "✓ 이웃" }).click();
await page.locator("[data-blog-title-bar]").getByRole("button", { name: "+ 이웃 추가" }).waitFor();
await page.locator("[data-blog-title-bar]").getByRole("button", { name: "+ 이웃 추가" }).click();
await page.locator("[data-blog-title-bar]").getByRole("button", { name: "✓ 이웃" }).waitFor();
check("끊었다 다시 추가해도 알림은 처음 한 번만", (await followNotes(ids.O, ids.V)) === 1);

// ── 이웃 목록 화면 ──
await widget.getByRole("link", { name: /이웃$/ }).first().click();
await page.waitForURL(`**/@${O}/neighbors`);
const list = page.locator("[data-neighbor-list]");
await list.waitFor();
const rows = await list.locator("[data-neighbor]").evaluateAll((els) => els.map((e) => e.getAttribute("data-neighbor")));
check("목록 화면: O의 이웃 Q·P (최근 순)", rows.join() === [Q, P].join(), rows.join());
check("목록 화면: P는 맞이웃 표시, Q는 아님",
  (await list.locator(`[data-neighbor="${P}"] [data-mutual]`).count()) === 1 && (await list.locator(`[data-neighbor="${Q}"] [data-mutual]`).count()) === 0);
check("목록 화면: 한 줄에 닉네임·블로그 이름·얼굴, 블로그로 가는 링크",
  (await list.locator(`[data-neighbor="${Q}"] a`).getAttribute("href")) === `/@${Q}` &&
    (await list.locator(`[data-neighbor="${Q}"]`).innerText()).includes(Q) &&
    (await list.locator(`[data-neighbor="${Q}"] img`).count()) === 1);
await page.screenshot({ path: `${outDir}/neighbors-page.png`, fullPage: true });

// 목록에서 바로 이웃 추가 → Q에게 알림
const qRow = list.locator(`[data-neighbor="${Q}"]`);
await qRow.getByRole("button", { name: `${Q}님을 이웃으로 추가` }).click();
await qRow.locator('[data-follow-toggle="on"]').waitFor();
check("목록에서 [+ 이웃 추가] → DB 이웃 + Q에게 알림",
  (await count("SELECT count(*)::int AS n FROM follows WHERE follower_id = $1 AND followee_id = $2", [ids.V, ids.Q])) === 1 && (await followNotes(ids.Q, ids.V)) === 1);
await qRow.getByRole("button", { name: `${Q}님 이웃 끊기` }).click();
await qRow.locator('[data-follow-toggle="off"]').waitFor();
await qRow.getByRole("button", { name: `${Q}님을 이웃으로 추가` }).click();
await qRow.locator('[data-follow-toggle="on"]').waitFor();
check("목록에서 끊고 다시 추가해도 Q 알림은 1개", (await followNotes(ids.Q, ids.V)) === 1);

// 나를 이웃으로 둔 주민 탭: P와 V(나). 나에게는 버튼이 없다
await page.locator('[data-neighbor-tab="followers"]').click();
await page.waitForURL(/tab=followers/);
await page.locator('[data-neighbors-page="followers"]').waitFor();
const fRows = await list.locator("[data-neighbor]").evaluateAll((els) => els.map((e) => e.getAttribute("data-neighbor")));
check("나를 이웃으로 둔 주민 탭: V(나)·P", fRows.join() === [V, P].join(), fRows.join());
check("내 줄에는 이웃 추가 버튼이 없고 (나) 표시",
  (await list.locator(`[data-neighbor="${V}"] [data-follow-toggle]`).count()) === 0 && (await list.locator(`[data-neighbor="${V}"]`).innerText()).includes("(나)"));
// 줄을 누르면 그 블로그로 (거기서 이웃 추가)
await list.locator(`[data-neighbor="${P}"] a`).click();
await page.waitForURL(`**/@${P}`);
check("목록 줄 → 그 블로그로 이동", page.url().endsWith(`/@${P}`));

// ── 알림함: O가 받은 이웃 추가 알림 → V의 블로그 ──
await o.page.goto(`${BASE}/notifications`);
const note = o.page.getByRole("button", { name: new RegExp(`${V}님이 나를 이웃으로 추가했어요`) });
check("알림함: `○○님이 나를 이웃으로 추가했어요`", await note.isVisible());
await o.page.screenshot({ path: `${outDir}/neighbors-notification.png` });
await note.click();
await o.page.waitForURL(`**/@${V}`);
check("알림을 누르면 추가한 회원의 블로그로 + 읽음", o.page.url().endsWith(`/@${V}`) &&
  (await count("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND kind = 'follow' AND read_at IS NULL", [ids.O])) === 0);
// 자기 자신은 이웃이 될 수 없고 알림도 없다 (DB CHECK도 막는다)
const selfBlocked = await db
  .query("INSERT INTO notifications (user_id, kind, actor_id) VALUES ($1, 'follow', $1)", [ids.O])
  .then(() => false, () => true);
check("자기 자신에게 이웃 추가 알림은 DB가 막음", selfBlocked);
const badShape = await db
  .query("INSERT INTO notifications (user_id, kind, actor_id, post_id) VALUES ($1, 'follow', $2, (SELECT id FROM posts LIMIT 1))", [ids.O, ids.Q])
  .then(() => false, () => true);
check("이웃 추가 알림에 글이 붙으면 DB가 막음 (모양 CHECK)", badShape);

// ── 방문자: 수만, 목록은 회원에게만 ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const g = await ctx.newPage();
  const errors = collectErrors(g);
  await g.goto(`${BASE}/@${O}`);
  const w = g.locator('[data-widget="neighbors"]');
  await w.waitFor();
  check("방문자: 위젯에 수만 보이고 얼굴·링크 없음",
    (await w.locator('[data-neighbor-count="following"]').innerText()) === "2" && (await w.locator("a").count()) === 0 && (await w.getByText("로그인하면 이웃 목록을").isVisible()));
  await g.goto(`${BASE}/@${O}/neighbors`);
  check("방문자: 목록 화면은 첫 화면으로", new URL(g.url()).pathname === "/", g.url());
  check("방문자 화면 오류 없음", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ── 휴대폰 (390px): 위젯과 목록 화면 ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await ctx.newPage();
  const errors = collectErrors(m);
  await loginDev(m, V);
  await m.goto(`${BASE}/@${O}`);
  const w = m.locator('[data-widget="neighbors"]');
  await w.scrollIntoViewIfNeeded();
  check("휴대폰: 블로그에 👫 이웃 위젯", await w.isVisible());
  await m.screenshot({ path: `${outDir}/neighbors-mobile-widget.png` });
  await m.goto(`${BASE}/@${O}/neighbors`);
  await m.locator("[data-neighbor-list]").waitFor();
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const btn = await m.locator(`[data-neighbor="${P}"] [data-follow-toggle]`).boundingBox();
  check("휴대폰: 목록 화면 가로 스크롤 없음, 버튼 44px 이상", overflow <= 0 && btn && btn.height >= 44, `${overflow}, ${btn?.height}`);
  await m.screenshot({ path: `${outDir}/neighbors-mobile-page.png`, fullPage: true });
  check("휴대폰 화면 오류 없음", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ── 탈퇴: 이웃·이웃 추가 알림이 있어도 회원 행을 지울 수 있다 (FK CASCADE) ──
await v.ctx.close();
await db.query("DELETE FROM users WHERE id = $1", [ids.V]);
check("V를 지우면 V의 이웃·알림도 함께 지워짐",
  (await count("SELECT count(*)::int AS n FROM follows WHERE follower_id = $1 OR followee_id = $1", [ids.V])) === 0 &&
    (await count("SELECT count(*)::int AS n FROM notifications WHERE actor_id = $1", [ids.V])) === 0);

check("화면 오류 없음", v.errors.length === 0 && o.errors.length === 0, [...v.errors, ...o.errors].join(" | "));
await o.ctx.close();
await browser.close();
await db.end();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
