// 가입 지급·활동 보상·레벨·내역 (GAME-01·02·03·05·07 / US1, US2, US4, SC-001·002·006·007·008·010·011)
// 사용: 개발 서버를 띄운 상태에서 node e2e/rewards.mjs <스크린샷 폴더>
// 실행마다 새 회원을 만들고, 경험치·어제 보상은 pg로 원장 줄을 넣어 준비한다
// (댓글·답글·공감 보상 자체는 e2e/comments.mjs·e2e/social.mjs, 가입 조작 거부는 e2e/signup.mjs가 확인한다)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const count = async (q, p) => (await one(q, p)).n;

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const n = Date.now() % 100_000_000;
const ids = { R1: `rwa${n}`, R2: `rwb${n}`, R3: `rwc${n}`, R4: `rwd${n}` };

async function member(id, character = "남자 주민") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await loginDev(page, id, character);
  page.on("dialog", (d) => d.accept());
  return { ctx, page, errors };
}
const userId = async (username) => (await one("SELECT id FROM users WHERE username = $1", [username])).id;
const ledgerCount = (uid, reason) => count("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = $2", [uid, reason]);
const totals = (uid) => one("SELECT COALESCE(SUM(exp_delta), 0)::int AS exp, COALESCE(SUM(coin_delta), 0)::int AS coins FROM point_ledger WHERE user_id = $1", [uid]);
async function setExp(uid, target) {
  const { exp } = await totals(uid);
  if (target > exp) await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', $2, 0)", [uid, target - exp]);
}
/** 레벨업 팝업이 떠 있으면 [확인]으로 닫는다 (팝업 자체는 e2e/notifications.mjs가 확인) */
async function closeLevelUp(page) {
  const dialog = page.locator("dialog[open]");
  if (!(await dialog.count())) return;
  await dialog.getByRole("button", { name: "확인" }).click();
  await dialog.waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
}
async function publish(page, { title, length = 100, visibility = "public" }) {
  await page.goto(`${BASE}/write`);
  await page.locator(".ProseMirror").waitFor();
  await closeLevelUp(page);
  await page.getByPlaceholder("제목").fill(title);
  if (visibility === "private") await page.getByRole("radio", { name: "🔒 비공개" }).click();
  await page.locator(".ProseMirror").click();
  await page.keyboard.insertText("가".repeat(length));
  await page.getByRole("button", { name: "발행하기" }).click();
  await page.waitForURL(/\/@[a-z0-9_]+\/\d+/);
  return Number(new URL(page.url()).pathname.match(/\/(\d+)$/)[1]);
}

// ══ US1 가입 지급 ══
{
  const v = await browser.newContext();
  const vp = await v.newPage();
  await vp.goto(BASE);
  await vp.getByRole("tab", { name: "회원가입" }).click();
  const cards = vp.locator("label", { has: vp.locator('input[type="radio"]') }).filter({ hasText: /주민/ });
  check("US1-1 가입 화면 캐릭터 카드 2개(남자·여자 주민)", (await cards.count()) === 2, String(await cards.count()));
  check("US1-1 처음엔 남자 주민 선택", await vp.locator("label", { hasText: "남자 주민" }).locator("input").isChecked());
  await v.close();
}
const R1 = await member(ids.R1, "여자 주민");
const uid1 = await userId(ids.R1);
{
  const owned = (await db.query("SELECT i.code FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 ORDER BY i.code", [uid1])).rows.map((r) => r.code);
  const equip = await one("SELECT ci.code AS c, bi.code AS b FROM profiles p JOIN items ci ON ci.id = p.character_item_id JOIN blogs b2 ON b2.owner_id = p.user_id JOIN items bi ON bi.id = b2.background_item_id WHERE p.user_id = $1", [uid1]);
  // 마을 개편 2차부터 기본 가구(화분·나무 의자)도 함께 받는다 (e2e/house.mjs)
  check("US1-2 보유 = 여자 주민 + 초원 + 기본 가구 2개", JSON.stringify(owned) === JSON.stringify(["bg_meadow", "char_girl", "fur_chair", "fur_plant"]), owned.join(","));
  check("US1-2 둘 다 장착", equip.c === "char_girl" && equip.b === "bg_meadow");
  const signup = (await db.query("SELECT coin_delta FROM point_ledger WHERE user_id = $1 AND reason = 'signup'", [uid1])).rows;
  check("US1-2 원장 signup 🪙 100 한 줄", JSON.stringify(signup) === JSON.stringify([{ coin_delta: 100 }]));
  check("US1-3 헤더 🪙 110 (가입 100 + 1일차 자동 출석 10, plan 남은 문제 1)", (await coins(R1.page)) === 110, String(await coins(R1.page)));
}
// US1-5·6 산 캐릭터도 장착 가능, 상점에 기본 캐릭터 없음
await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code = 'char_cat'", [uid1]);
await R1.page.goto(`${BASE}/closet`);
await R1.page.getByRole("button", { name: /고양이/ }).click();
await R1.page.waitForTimeout(800);
check("US1-5 가입 캐릭터 + 산 캐릭터 → 산 것도 장착", (await one("SELECT i.code FROM profiles p JOIN items i ON i.id = p.character_item_id WHERE p.user_id = $1", [uid1])).code === "char_cat");
await R1.page.goto(`${BASE}/shop`);
const shopText = await R1.page.locator("main").innerText();
check("US1-6 상점에 남자 주민·여자 주민 없음", !shopText.includes("남자 주민") && !shopText.includes("여자 주민"));

// ══ US2 글 보상: 100자 공개만, 하루 3번, 수정·비공개 없음 ══
const before = await totals(uid1);
const p1 = await publish(R1.page, { title: "보상 1" });
const t1 = await totals(uid1);
check("US2-1 100자 공개 새 글 → ✨30·🪙30", t1.exp - before.exp === 30 && t1.coins - before.coins === 30, JSON.stringify([before, t1]));
await publish(R1.page, { title: "99자", length: 99 });
check("US2-3 99자 → 보상 없음", (await ledgerCount(uid1, "post")) === 1);
const pPrivate = await publish(R1.page, { title: "비공개", visibility: "private" });
check("US2-4 비공개 → 보상 없음", (await ledgerCount(uid1, "post")) === 1);
await publish(R1.page, { title: "보상 2" });
await publish(R1.page, { title: "보상 3" });
await publish(R1.page, { title: "보상 4 (상한)" });
check("US2-2 같은 날 공개 글 4개 → 보상 3번", (await ledgerCount(uid1, "post")) === 3);
// 비공개 → 공개 수정 → 보상 없음
await R1.page.goto(`${BASE}/write/${pPrivate}`);
await R1.page.locator(".ProseMirror").waitFor();
await R1.page.getByRole("radio", { name: "🌍 공개" }).click();
await R1.page.getByRole("button", { name: "수정 완료" }).click();
await R1.page.waitForURL(new RegExp(`/${pPrivate}$`));
check("US2-5 수정(비공개 → 공개) → 보상 없음", (await ledgerCount(uid1, "post")) === 3);
// 보상받은 글 삭제 → 원장·레벨 그대로 (회수 없음)
const tBeforeDelete = await totals(uid1);
await db.query("DELETE FROM posts WHERE id = $1", [p1]);
const tAfterDelete = await totals(uid1);
check("US2-7·SC-011 보상받은 글 삭제 → 원장 합계 그대로", JSON.stringify(tBeforeDelete) === JSON.stringify(tAfterDelete));

// ══ US2-9 어제 보상은 오늘 상한에 안 셈 ══
const R2 = await member(ids.R2);
const uid2 = await userId(ids.R2);
await db.query(
  `INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta, ref_id, created_at)
   SELECT $1, 'post', 30, 30, 'y' || g, (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul') - interval '1 hour'
   FROM generate_series(1, 3) g`,
  [uid2],
);
await publish(R2.page, { title: "오늘 글" });
check("US2-9 어제 보상 3번 + 오늘 글 → 보상 있음", (await ledgerCount(uid2, "post")) === 4);

// ══ SC-006 같은 보상 요청 동시 12개 → 상한(10) 초과 0건 ══
const R3 = await member(ids.R3);
const uid3 = await userId(ids.R3);
{
  const target = (await one("SELECT id FROM posts WHERE blog_id = (SELECT id FROM blogs WHERE owner_id = $1) AND visibility = 'public' ORDER BY id LIMIT 1", [uid1])).id;
  // 탭 12개에서 댓글 등록을 동시에 누른다
  const tabs = await Promise.all(Array.from({ length: 12 }, () => R3.ctx.newPage()));
  await Promise.all(tabs.map((t) => t.goto(`${BASE}/@${ids.R1}/${target}`)));
  const forms = tabs.map((t) => t.getByRole("region", { name: "댓글" }).locator("form").last());
  await Promise.all(forms.map((f, i) => f.locator("textarea").fill(`동시 댓글 ${i}`)));
  await Promise.all(forms.map((f) => f.getByRole("button", { name: /댓글 등록/ }).click()));
  await Promise.all(tabs.map((t, i) => t.getByRole("region", { name: "댓글" }).getByText(`동시 댓글 ${i}`, { exact: true }).waitFor({ timeout: 20000 }).catch(() => {})));
  const commentsMade = await count("SELECT count(*)::int AS n FROM comments WHERE author_id = $1", [uid3]);
  await Promise.all(tabs.map((t) => t.close()));
  check("SC-006 동시 12개 댓글 → 보상 정확히 10번", (await ledgerCount(uid3, "comment")) === 10, `댓글 ${commentsMade}, 보상 ${await ledgerCount(uid3, "comment")}`);
}

// ══ US2-8·10·11 레벨 ══
await setExp(uid2, 95);
// 경험치 95 → 남의 글 댓글(✨5) → 100 → Lv.2
await R2.page.goto(`${BASE}/@${ids.R1}/${(await one("SELECT id FROM posts WHERE blog_id = (SELECT id FROM blogs WHERE owner_id = $1) AND visibility = 'public' ORDER BY id LIMIT 1", [uid1])).id}`);
{
  const form = R2.page.getByRole("region", { name: "댓글" }).locator("form").last();
  await form.locator("textarea").fill("레벨업 댓글");
  await form.getByRole("button", { name: /댓글 등록/ }).click();
  await R2.page.getByRole("region", { name: "댓글" }).getByText("레벨업 댓글").waitFor();
}
await R2.page.waitForLoadState("networkidle");
check("US2-8 경험치 95 + 5 = 100 → 헤더 Lv.2 (같은 화면)", (await R2.page.getByRole("banner").innerText()).includes("Lv.2"), (await totals(uid2)).exp);
await R2.page.keyboard.press("Escape").catch(() => {});
await db.query("UPDATE notifications SET read_at = now() WHERE user_id = $1", [uid2]);
await setExp(uid2, 150);
await R2.page.goto(`${BASE}/closet`);
const closetText = await R2.page.locator("main").innerText();
check("US2-10 경험치 150 → 꾸미기 Lv.2·`50 / 200 EXP`", closetText.includes("Lv.2") && closetText.includes("50 / 200 EXP"));
await setExp(uid2, 485_100);
await db.query("UPDATE notifications SET read_at = now() WHERE user_id = $1", [uid2]);
await R2.page.reload();
check("US2-11 485,100 → Lv.99·MAX", (await R2.page.getByRole("banner").innerText()).includes("Lv.99") && (await R2.page.getByText("MAX", { exact: true }).isVisible()));

// ══ US2-13 375px 헤더 ══
{
  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, storageState: await R1.ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/feed`);
  const lv = mp.getByRole("banner").getByTitle("레벨");
  const coin = mp.getByRole("banner").getByTitle("코인");
  check("SC-008 375px 헤더 `Lv.N`·`🪙 N` 보임", (await lv.isVisible()) && (await coin.isVisible()));
  await m.close();
}

// ══ US4 내역 ══
// 글 보상으로 Lv.2가 되어 레벨업 팝업이 화면을 덮으므로 먼저 읽음으로 (팝업은 e2e/notifications.mjs가 확인)
await db.query("UPDATE notifications SET read_at = now() WHERE user_id = $1", [uid1]);
// 구매 줄
await R1.page.goto(`${BASE}/shop`);
await R1.page.locator("article", { hasText: "바닷가" }).getByRole("button", { name: "사기" }).click();
await R1.page.getByRole("status").filter({ hasText: "샀어요" }).waitFor();
await R1.page.getByRole("banner").getByTitle("코인").click();
await R1.page.waitForURL(/\/wallet/);
check("US4-1·SC-010 헤더 🪙 → /wallet", new URL(R1.page.url()).pathname === "/wallet");
const walletText = await R1.page.locator("main").innerText();
const walletCoins = Number(walletText.match(/🪙 ([\d,]+)/)[1].replace(/,/g, ""));
check("US4-2·SC-002 위 요약 코인 = 헤더 코인 = 원장 합계", walletCoins === (await coins(R1.page)) && walletCoins === (await totals(uid1)).coins, `${walletCoins}`);
const buyLine = R1.page.locator("main li", { hasText: "🏪 아이템 구매 · 바닷가" });
check("US4-3 구매 줄 `🏪 아이템 구매 · 바닷가`·빨간 `🪙 −120`",
  (await buyLine.count()) === 1 && (await buyLine.innerText()).includes("🪙 −120") && (await buyLine.locator(".text-berry").count()) === 1);
check("US4 사유 이름 `📮 출석`·`✏️ 글 작성`·`🎉 가입 축하`", ["📮 출석", "✏️ 글 작성", "🎉 가입 축하"].every((t) => walletText.includes(t)));
check("US4 시각 `YYYY. MM. DD. HH:MM`", /\d{4}\. \d{2}\. \d{2}\. \d{2}:\d{2}/.test(walletText));
const signupLine = await R1.page.locator("main li", { hasText: "🎉 가입 축하" }).first().innerText();
check("US4 0은 생략 (가입 축하 줄에 ✨ 없음)", !signupLine.includes("✨"));
check("US4 맨 아래 `코인은 상점에서 쓸 수 있어요.`", walletText.includes("코인은 상점에서 쓸 수 있어요."));
check("US4-6 다른 회원 기록 안 보임", (await R1.page.locator("main li").count()) === Math.min(20, await count("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1", [uid1])));
await R1.page.screenshot({ path: `${outDir}/wallet.png`, fullPage: true });
// 21개 이상 → 20개, 기록 N개, 2페이지
await db.query("INSERT INTO point_ledger (user_id, reason, coin_delta) SELECT $1, 'purchase', -1 FROM generate_series(1, 15)", [uid1]);
const total = await count("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1", [uid1]);
await R1.page.reload();
check("US4-4 21개 이상 → 20줄·`기록 N개`·2페이지", (await R1.page.locator("main li").count()) === 20 && (await R1.page.locator("main").innerText()).includes(`기록 ${total}개`) &&
  (await R1.page.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2" }).count()) === 1, `${total}`);
// 빈 회원
const R4 = await member(ids.R4);
await db.query("DELETE FROM point_ledger WHERE user_id = $1", [await userId(ids.R4)]);
await R4.page.goto(`${BASE}/wallet`);
check("US4-5 빈 회원 `아직 기록이 없어요`", await R4.page.getByText("아직 기록이 없어요").isVisible());
// 방문자
{
  const v = await browser.newContext();
  const vp = await v.newPage();
  await vp.goto(`${BASE}/wallet`);
  check("US4-7 방문자 /wallet → /", new URL(vp.url()).pathname === "/");
  await v.close();
}

const allErrors = [R1, R2, R3, R4].flatMap((m) => m.errors).filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", allErrors.length === 0, allErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
