// 레벨업 팝업·알림함 (GAME-06·GAME-08 / US5, US6, SC-009·012, quickstart US5·US6)
// 공감·댓글·답글 알림 (SOCIAL 2차 T047~T051)도 여기서 확인한다
// 사용: 개발 서버를 띄운 상태에서 node e2e/notifications.mjs <스크린샷 폴더>
// 실행마다 새 회원 A(글 주인)·B·C·D·E·F를 만들고, 경험치는 pg로 원장 줄을 넣어 준비한다
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
const ids = { A: `nta${n}`, B: `ntb${n}`, C: `ntc${n}`, D: `ntd${n}`, E: `nte${n}`, F: `ntf${n}` };

async function member(id, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = collectErrors(page, { keepLevelUp: true });
  await loginDev(page, id, "남자 주민");
  return { ctx, page, errors };
}
const userId = async (username) => (await one("SELECT id FROM users WHERE username = $1", [username])).id;
const blogOf = async (username) => (await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [username])).id;
const newPost = async (username, title) =>
  (await one("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, $2, '<p>x</p>', 'x') RETURNING id", [await blogOf(username), title])).id;
/** 누적 경험치를 target으로 맞춘다 (레벨업 알림 없이 원장 줄 하나) */
async function setExp(uid, target) {
  const { exp } = await one("SELECT COALESCE(SUM(exp_delta), 0)::int AS exp FROM point_ledger WHERE user_id = $1", [uid]);
  if (target > exp) await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', $2, 0)", [uid, target - exp]);
}
const notes = (uid, extra = "") => db.query(`SELECT kind, actor_id, post_id, level, read_at FROM notifications WHERE user_id = $1 ${extra} ORDER BY id`, [uid]).then((r) => r.rows);
const unreadLevelUps = async (uid) => count("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND kind = 'level_up' AND read_at IS NULL", [uid]);
const likeBtn = (page) => page.getByRole("button", { name: /공감 \d+/ });
async function clickLike(page) {
  const done = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
  await likeBtn(page).click();
  await done;
  await page.waitForLoadState("networkidle");
}
const section = (page) => page.getByRole("region", { name: "댓글" });
async function writeComment(page, text) {
  const form = section(page).locator("form").last();
  await form.locator("textarea").fill(text);
  await form.getByRole("button", { name: /댓글 등록/ }).click();
  await section(page).locator('[id^="comment-"]', { hasText: text }).first().waitFor();
}
async function writeReply(page, commentText, text) {
  const line = section(page).locator('[id^="comment-"]', { hasText: commentText }).first();
  await line.getByRole("button", { name: "답글", exact: true }).click();
  await line.locator("form").locator("textarea").fill(text);
  await line.locator("form").getByRole("button", { name: "답글 등록" }).click();
  await section(page).locator('[id^="reply-"]', { hasText: text }).first().waitFor();
}
const dialog = (page) => page.locator("dialog[open]");
const bell = (page) => page.getByRole("banner").getByRole("link", { name: /^알림/ });
const badge = async (page) => ((await bell(page).locator("[data-badge]").count()) ? (await bell(page).locator("[data-badge]").innerText()).trim() : null);

const A = await member(ids.A);
const B = await member(ids.B);
const C = await member(ids.C);
const uid = { A: await userId(ids.A), B: await userId(ids.B), C: await userId(ids.C) };
const P = await newPost(ids.A, "알림 받을 글");
const BP = await newPost(ids.B, "B의 글");
const url = (id, owner = ids.A) => `${BASE}/@${owner}/${id}`;

// ══ US6-10 자기 활동 → 알림 없음 ══
await A.page.goto(url(P));
await clickLike(A.page);
await writeComment(A.page, "내 글에 내가 단 댓글");
check("US6-10 내 글 공감·댓글 → 알림 없음", (await notes(uid.A)).length === 0);
await clickLike(A.page); // 공감 취소 (뒤 확인이 B 공감만 세게)

// ══ US5-1·3 다른 회원 공감으로 레벨업 → 글 주인 다음 화면에서 팝업 (경험치 58 + 공감 보상 2 = 60 → Lv.3, 곡선 10 × n × (n − 1)) ══
await setExp(uid.A, 58);
await B.page.goto(url(P));
await clickLike(B.page);
const aNotes = await notes(uid.A);
check("US5-3·SC-012 B 공감 → A에게 like 1행 + level_up 3 1행",
  aNotes.filter((x) => x.kind === "like" && x.actor_id === uid.B && x.post_id === P).length === 1 && aNotes.filter((x) => x.kind === "level_up" && x.level === 3).length === 1,
  JSON.stringify(aNotes.map((x) => x.kind + (x.level ?? ""))));
check("US6-7 공감 알림은 팝업 없음 (B 화면)", (await dialog(B.page).count()) === 0);
await A.page.goto(`${BASE}/feed`);
await dialog(A.page).waitFor({ timeout: 5000 }).catch(() => {});
const popText = (await dialog(A.page).count()) ? await dialog(A.page).innerText() : "";
check("US5-1 다음 화면에서 `Lv.3이 되었어요!` 팝업", popText.includes("Lv.3이 되었어요!"), popText.replace(/\n/g, " ").slice(0, 80));
check("US5-2 Lv.3 판매 아이템(벚꽃길) 보임, 캐릭터(판다) 안 보임", popText.includes("이제 이런 친구를 데려올 수 있어요") && popText.includes("벚꽃길") && !popText.includes("판다"));
check("US6-1 🔔 안 읽은 수 2", (await badge(A.page)) === "2", String(await badge(A.page)));
await A.page.screenshot({ path: `${outDir}/levelup-lv3.png` });
await dialog(A.page).getByRole("button", { name: "확인" }).click();
await dialog(A.page).waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
await A.page.reload();
check("US5-4 [확인] 뒤 새로고침 → 팝업 안 뜸", (await dialog(A.page).count()) === 0);
check("US5-4 레벨업 알림 읽음, 알림함에는 남음", (await unreadLevelUps(uid.A)) === 0 && (await notes(uid.A)).some((x) => x.kind === "level_up"));

// ══ 공감 → 취소 → 공감 → 공감 알림 1행(같은 사람·같은 글은 한 번만, 2026-10-09 결정), 보상은 1번 (SOCIAL T050) ══
await clickLike(B.page);
await clickLike(B.page);
const likeNotes = (await notes(uid.A)).filter((x) => x.kind === "like").length;
check("SOC T050 공감 → 취소 → 공감 → 공감 알림은 1행 그대로", likeNotes === 1, String(likeNotes));
check("SOC T050 공감 보상은 1번", (await count("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'like_received'", [uid.A])) === 1);

// ══ 댓글·답글 알림 (SOCIAL T051) ══
await writeComment(B.page, "B가 남긴 댓글");
check("SOC T051 B가 A의 글에 댓글 → A에게 comment 1행", (await notes(uid.A, "AND kind = 'comment'")).length === 1);
await C.page.goto(url(P));
await writeComment(C.page, "C가 남긴 댓글");
await B.page.reload();
await writeReply(B.page, "C가 남긴 댓글", "B가 C에게 단 답글");
check("SOC T051 B가 C의 댓글(A의 글)에 답글 → C에게 reply 1행·post = A의 글", JSON.stringify((await notes(uid.C)).map((x) => [x.kind, x.post_id])) === JSON.stringify([["reply", P]]));
check("SOC T051 답글 → 글 주인 A에게는 reply 없음", (await notes(uid.A, "AND kind = 'reply'")).length === 0);
await C.page.reload();
await writeReply(C.page, "C가 남긴 댓글", "C가 자기 댓글에 단 답글");
// C는 댓글·답글 보상으로 Lv.2(경험치 20)가 될 수 있어 레벨업 알림은 빼고 센다
check("US6-10 자기 댓글에 답글 → 알림 없음", (await notes(uid.C, "AND kind <> 'level_up'")).length === 1);

// ══ US6 알림함 ══
await A.page.goto(`${BASE}/notifications`);
const listText = await A.page.locator("main").innerText();
const nick = { B: ids.B, C: ids.C };
check("US6-7 공감 문구", listText.includes(`❤️ ${nick.B}님이 「알림 받을 글」에 공감했어요`));
check("US6-8 댓글 문구", listText.includes(`💬 ${nick.B}님이 「알림 받을 글」에 댓글을 달았어요`) && listText.includes(`💬 ${nick.C}님이 「알림 받을 글」에 댓글을 달았어요`));
check("US6 레벨업 문구", listText.includes("🎉 Lv.3이 되었어요!"));
check("FR-043 시간 `방금`", listText.includes("방금"));
const firstLine = (await A.page.locator("main li").first().innerText()).trim();
check("FR-043 최신순 (맨 위 = C의 댓글)", firstLine.startsWith(`💬 ${nick.C}님이`), firstLine.slice(0, 40));
// 안 읽은 줄 = 공감 1(같은 사람·같은 글은 한 번만, 2026-10-09) + 댓글 2 (레벨업은 [확인]으로 읽음)
check("FR-043 안 읽은 줄 노란 배경", (await A.page.locator('main [data-unread="true"]').count()) === 3);
check("US6-1 🔔 숫자 = 안 읽은 수", (await badge(A.page)) === String(await count("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL", [uid.A])));
await A.page.screenshot({ path: `${outDir}/notifications-list.png`, fullPage: true });

// 다른 회원(C)의 알림은 A 알림함에 없음
check("US6-4 다른 회원 알림 안 보임", !listText.includes("내 댓글에 답글을 달았어요"));

// 댓글 알림 클릭 → 그 글 #comments, 읽음
await A.page.locator("main li", { hasText: `${nick.B}님이 「알림 받을 글」에 댓글` }).getByRole("button").click();
await A.page.waitForURL(/#comments$/, { timeout: 10000 }).catch(() => {});
check("US6-8 댓글 알림 → `/@A/P#comments`", A.page.url().endsWith(`/@${ids.A}/${P}#comments`), A.page.url());
const scrolled = await A.page.evaluate(() => {
  const el = document.getElementById("comments");
  return el ? el.getBoundingClientRect().top < window.innerHeight : false;
});
check("SOC T051 #comments 댓글 영역이 화면에 보임", scrolled);
check("US6-8 누른 알림 읽음", (await one("SELECT read_at FROM notifications WHERE user_id = $1 AND kind = 'comment' AND actor_id = $2", [uid.A, uid.B])).read_at !== null);

// 레벨업 알림 클릭 → /shop
await A.page.goto(`${BASE}/notifications`);
await A.page.locator("main li", { hasText: "Lv.3이 되었어요" }).getByRole("button").click();
await A.page.waitForURL(/\/shop$/, { timeout: 10000 }).catch(() => {});
check("US6-3 레벨업 알림 → /shop", new URL(A.page.url()).pathname === "/shop", A.page.url());

// [모두 읽음]
await A.page.goto(`${BASE}/notifications`);
await A.page.getByRole("button", { name: "모두 읽음" }).click();
await A.page.waitForLoadState("networkidle");
await A.page.getByRole("button", { name: "모두 읽음" }).waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
check("US6-2 [모두 읽음] → 숫자 사라짐·노란 배경 없음", (await badge(A.page)) === null && (await A.page.locator('main [data-unread="true"]').count()) === 0);

// ══ US5-1 본인 활동 보상으로 레벨업 → 그 화면에서 바로 팝업 (115 + 댓글 5 = 120 → Lv.4) ══
await setExp(uid.A, 115);
await A.page.goto(url(BP, ids.B));
await writeComment(A.page, "A가 B 글에 단 댓글");
await dialog(A.page).waitFor({ timeout: 5000 }).catch(() => {});
check("US5-1 내 댓글 보상으로 Lv.4 → 그 화면에서 팝업", (await dialog(A.page).count()) === 1 && (await dialog(A.page).innerText()).includes("Lv.4가 되었어요!"));
await dialog(A.page).getByRole("button", { name: "상점 가기" }).click();
await A.page.waitForURL(/\/shop$/, { timeout: 10000 }).catch(() => {});
check("US5-4 [상점 가기] → /shop, 레벨업 읽음", new URL(A.page.url()).pathname === "/shop" && (await unreadLevelUps(uid.A)) === 0);
check("US5 B에게 댓글 알림 1행", (await notes(uid.B, "AND kind = 'comment'")).length === 1);

// 레벨이 안 오른 보상 → 팝업 없음
await A.page.goto(url(BP, ids.B));
await writeComment(A.page, "레벨 안 오르는 댓글");
check("US5-5 레벨 안 오른 보상 → 팝업 없음", (await dialog(A.page).count()) === 0 && (await unreadLevelUps(uid.A)) === 0);

// ══ US5-6 안 읽은 Lv.3·Lv.4 → Lv.4 하나만, 둘 다 읽음 ══
const D = await member(ids.D);
const uidD = await userId(ids.D);
await db.query("INSERT INTO notifications (user_id, kind, level) VALUES ($1, 'level_up', 3), ($1, 'level_up', 4)", [uidD]);
await D.page.goto(`${BASE}/feed`);
await dialog(D.page).waitFor({ timeout: 5000 }).catch(() => {});
const dText = (await dialog(D.page).count()) ? await dialog(D.page).innerText() : "";
check("FR-041 안 읽은 Lv.3·Lv.4 → `Lv.4가 되었어요!` 하나", (await dialog(D.page).count()) === 1 && dText.includes("Lv.4가 되었어요!") && !dText.includes("Lv.3"));

// 조작: dismissLevelUp에 level = 100·0·문자 → 변화 없음 (진짜 [확인] 요청을 잡아 값만 바꿔 다시 보낸다)
{
  let captured = null;
  await D.page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"] && !captured) {
      captured = { url: req.url(), headers: req.headers(), body: req.postData() ?? "" };
      return route.abort();
    }
    return route.continue();
  });
  await dialog(D.page).getByRole("button", { name: "확인" }).click();
  await D.page.waitForTimeout(800);
  await D.page.unroute("**/*");
  const replaced = (v) => captured.body.replace(/(name="[^"]*level"\r\n\r\n)4/, `$1${v}`);
  const statuses = [];
  for (const v of ["100", "0", "abc"]) {
    const r = await D.page.request.post(captured.url, { headers: captured.headers, data: replaced(v) });
    statuses.push(r.status());
  }
  check("contracts 7 dismissLevelUp level=100·0·문자 → 변화 없음, 500 없음", captured && (await unreadLevelUps(uidD)) === 2 && statuses.every((s) => s < 500), `${statuses} / body ${captured?.body.length}`);
}
await D.page.reload();
await dialog(D.page).waitFor({ timeout: 5000 }).catch(() => {});
await dialog(D.page).getByRole("button", { name: "확인" }).click();
await D.page.waitForLoadState("networkidle");
await D.page.waitForTimeout(500);
check("FR-041 [확인] → Lv.3·Lv.4 둘 다 읽음", (await unreadLevelUps(uidD)) === 0);

// Lv.99 문구, Esc = [확인]
await db.query("INSERT INTO notifications (user_id, kind, level) VALUES ($1, 'level_up', 99)", [uidD]);
await D.page.reload();
await dialog(D.page).waitFor({ timeout: 5000 }).catch(() => {});
check("US5 Lv.99 → `최고 레벨 Lv.99가 되었어요!`", (await dialog(D.page).count()) === 1 && (await dialog(D.page).innerText()).includes("최고 레벨 Lv.99가 되었어요!"));
await D.page.screenshot({ path: `${outDir}/levelup-lv99.png` });
await D.page.keyboard.press("Escape");
await D.page.waitForLoadState("networkidle");
await D.page.waitForTimeout(500);
await D.page.reload();
check("Esc → [확인]과 같이 읽음, 다시 안 뜸", (await unreadLevelUps(uidD)) === 0 && (await dialog(D.page).count()) === 0);

// 같은 레벨업 동시 기록 → 1행 (DB 고유 인덱스)
{
  const r = await Promise.allSettled([
    db.query("INSERT INTO notifications (user_id, kind, level) VALUES ($1, 'level_up', 50) ON CONFLICT DO NOTHING", [uidD]),
    db.query("INSERT INTO notifications (user_id, kind, level) VALUES ($1, 'level_up', 50) ON CONFLICT DO NOTHING", [uidD]),
  ]);
  check("FR-037 같은 레벨 동시 기록 → 알림 1행", r.every((x) => x.status === "fulfilled") && (await count("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND level = 50", [uidD])) === 1);
  await db.query("UPDATE notifications SET read_at = now() WHERE user_id = $1", [uidD]);
}

// ══ 🔔 배지 3 → `3`, 10 이상 → `9+` ══
const like = (uidTo, n) =>
  db.query("INSERT INTO notifications (user_id, kind, actor_id, post_id) SELECT $1, 'like', $2, $3 FROM generate_series(1, $4)", [uidTo, uid.A, P, n]);
await like(uidD, 3);
await D.page.goto(`${BASE}/feed`);
check("US6-1 안 읽은 3개 → `3`", (await badge(D.page)) === "3", String(await badge(D.page)));
await like(uidD, 9);
await D.page.reload();
check("US6-1 안 읽은 12개 → `9+`", (await badge(D.page)) === "9+", String(await badge(D.page)));

// 조작: openNotification에 남의 알림·범위 밖 ID → 변화 없음, /notifications
{
  await D.page.goto(`${BASE}/notifications`);
  let captured = null;
  await D.page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"] && !captured) {
      captured = { url: req.url(), headers: req.headers(), body: req.postData() ?? "" };
      return route.abort();
    }
    return route.continue();
  });
  await D.page.locator("main li").first().getByRole("button").click();
  await D.page.waitForTimeout(800);
  await D.page.unroute("**/*");
  const otherId = (await one("SELECT id FROM notifications WHERE user_id = $1 AND read_at IS NULL ORDER BY id LIMIT 1", [uid.C]))?.id
    ?? (await one("SELECT id FROM notifications WHERE user_id = $1 ORDER BY id LIMIT 1", [uid.C])).id;
  const otherBefore = (await one("SELECT read_at FROM notifications WHERE id = $1", [otherId])).read_at;
  const dUnread = await count("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL", [uidD]);
  const statuses = [];
  for (const v of [String(otherId), "2147483648", "1e3", "abc"]) {
    const r = await D.page.request.post(captured.url, { headers: captured.headers, data: captured.body.replace(/(name="[^"]*id"\r\n\r\n)\d+/, `$1${v}`) });
    statuses.push(r.status());
  }
  const otherAfter = (await one("SELECT read_at FROM notifications WHERE id = $1", [otherId])).read_at;
  check("contracts 7 남의 알림 ID로 openNotification → 그 알림 그대로", String(otherBefore) === String(otherAfter));
  check("contracts 7 범위 밖 ID → 변화 없음, 500 없음",
    (await count("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL", [uidD])) === dUnread && statuses.every((s) => s < 500), String(statuses));
}

// ══ 빈 목록, 방문자, 큰 page ══
const E = await member(ids.E);
await E.page.goto(`${BASE}/notifications`);
check("US6-5 빈 목록 `아직 알림이 없어요`, [모두 읽음] 없음",
  (await E.page.getByText("아직 알림이 없어요").isVisible()) && (await E.page.getByRole("button", { name: "모두 읽음" }).count()) === 0);
await E.page.screenshot({ path: `${outDir}/notifications-empty.png`, fullPage: true });
const big = await E.page.goto(`${BASE}/notifications?page=99999999999999999999`);
check("#21 ?page=99999999999999999999 → 200", big?.status() === 200, String(big?.status()));
{
  const v = await browser.newContext();
  const vp = await v.newPage();
  await vp.goto(`${BASE}/feed`);
  check("US6-6 방문자 헤더에 🔔 없음", (await vp.getByRole("banner").getByRole("link", { name: /^알림/ }).count()) === 0);
  await vp.goto(`${BASE}/notifications`);
  check("US6-6 방문자 /notifications → /", new URL(vp.url()).pathname === "/", vp.url());
  await v.close();
}

// ══ FR-046 행동한 회원 탈퇴 → 그 알림 삭제 ══
const F = await member(ids.F);
const uidF = await userId(ids.F);
await F.page.goto(url(P));
await clickLike(F.page);
const fBefore = await count("SELECT count(*)::int AS n FROM notifications WHERE actor_id = $1", [uidF]);
await F.ctx.close();
await db.query("DELETE FROM users WHERE id = $1", [uidF]);
check("FR-046 행동한 회원 삭제 → 그 회원이 남긴 알림 삭제", fBefore === 1 && (await count("SELECT count(*)::int AS n FROM notifications WHERE actor_id = $1", [uidF])) === 0, `${fBefore}`);

// ══ 375px 헤더 🔔 ══
{
  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, storageState: await D.ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/feed`);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const banner = await mp.getByRole("banner").innerText();
  check("SC-008 375px 헤더 🔔·Lv·🪙 보임, 가로 스크롤 없음", overflow <= 0 && (await bell(mp).isVisible()) && /Lv\.\d+/.test(banner) && banner.includes("🪙"), `${overflow}`);
  await mp.screenshot({ path: `${outDir}/header-bell-375.png` });
  await mp.goto(`${BASE}/notifications`);
  const overflow2 = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("SC-008 375px 알림함 가로 스크롤 없음", overflow2 <= 0, String(overflow2));
  await m.close();
}

// D의 "Failed to fetch"는 조작 시험에서 진짜 요청을 일부러 끊은 것
const allErrors = [A, B, C, D, E].flatMap((m) => m.errors).filter((e) => e.startsWith("pageerror") && !(e.includes("Failed to fetch") && D.errors.includes(e)));
check("화면 오류 없음", allErrors.length === 0, allErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
