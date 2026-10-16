// 가만히 동작·마을 테마·이웃 말풍선 (사용자 요청 2026-10-12)
//  - "가만히 있으면 캐릭터가 재밌는 모션 랜덤으로 하나씩 하게 해줘" (광장 data-idle, 우리 집 방 data-idle)
//  - "상점에 파는 배경 같은건 눈배경이다 하면 마을에 눈쌓여있고 … 보라색 배경이면 보라색 느낌 마을로" (data-theme, 친구 마을은 주인 배경)
//  - "즐겨찾기해서 마을에 추가한 이웃들은 … 클릭하거나 가까이가서 스페이스바 누르면 … 한 문장 말풍선" (마을 한마디 / 공개 글 문장)
// 사용: 개발 서버를 띄운 상태에서 node e2e/idle-theme.mjs <스크린샷 폴더>
// 요구사항: TOWN-22·TOWN-23·TOWN-24
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const n = Date.now() % 100_000_000;
const [A, B, C, D] = ["ia", "ib", "ic", "id"].map((p) => `${p}${n}`);
const userId = async (u) => (await one("SELECT id FROM users WHERE username = $1", [u])).id;
const blogOf = async (u) => (await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [u])).id;
const errors = [];

// 이웃 B·C·D 가입. B는 내 정보 화면에서 마을 한마디를 적는다
const GREETING = "안녕! 반가워요 <b>굵게</b>";
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const u of [C, D, B]) {
    const p = await ctx.newPage();
    errors.push(...collectErrors(p));
    await loginDev(p, u);
    if (u === B) {
      await p.goto(`${BASE}/settings/account`);
      const input = p.getByLabel("마을 한마디");
      check("내 정보: 마을 한마디 칸과 안내", (await input.isVisible()) && (await p.getByText("말풍선으로 보여요").isVisible()));
      await input.fill("가".repeat(61));
      await p.locator('[data-section="greeting"]').getByRole("button", { name: "저장" }).click();
      const alert = p.locator('[data-section="greeting"] [role="alert"]');
      await alert.waitFor({ timeout: 10000 }).catch(() => {});
      check("마을 한마디 61자는 거절", (await alert.innerText().catch(() => "")).includes("60자까지"), await alert.innerText().catch(() => ""));
      await input.fill(`   ${GREETING}   `);
      await p.locator('[data-section="greeting"]').getByRole("button", { name: "저장" }).click();
      await p.locator('[data-section="greeting"] [role="status"]').waitFor({ timeout: 10000 }).catch(() => {});
      const saved = await one("SELECT greeting FROM profiles WHERE user_id = $1", [await userId(B)]);
      check("마을 한마디 저장 (앞뒤 공백 지움)", saved.greeting === GREETING, saved.greeting);
      await p.screenshot({ path: `${outDir}/settings-greeting.png`, fullPage: true });
    }
    await ctx.clearCookies();
    await p.close();
  }
  await ctx.close();
}

// C: 공개 글 하나 + 비공개 글 하나 (비공개 문장은 말풍선에 나오면 안 된다)
const PUBLIC_SENTENCES = ["오늘은 공원에서 산책을 했어요.", "하늘이 정말 맑았어요!", "다음에는 친구랑 같이 가고 싶어요."];
await db.query("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, '산책', '<p>x</p>', $2)", [await blogOf(C), PUBLIC_SENTENCES.join(" ")]);
await db.query("INSERT INTO posts (blog_id, title, content_html, content_text, visibility) VALUES ($1, '비밀', '<p>x</p>', '비밀 문장은 절대 보이면 안 돼요.', 'private')", [await blogOf(C)]);

// B는 딸기우유 송아지(크게), C는 토끼를 블로그에 전시 → 마을에서 이웃(NPC)이 데리고 다닌다
async function showcase(user, species, { skin = null, size = "normal" } = {}) {
  const uid = await userId(user);
  const a = await one(
    `INSERT INTO user_animals (user_id, sex, species_id, status, growth, source, hatched_at, grown_at, display_size)
     VALUES ($1, 'female', (SELECT id FROM animal_species WHERE code = $2), 'grown', 0, 'shop', now(), now(), $3) RETURNING id`,
    [uid, species, size],
  );
  if (skin) {
    const sk = await one("SELECT id FROM animal_skins WHERE code = $1", [skin]);
    await db.query("INSERT INTO user_animal_skins (user_id, skin_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [uid, sk.id]);
    await db.query("UPDATE user_animals SET skin_id = $2 WHERE id = $1", [a.id, sk.id]);
  }
  await db.query("UPDATE blogs SET showcase_animal_id = $2 WHERE owner_id = $1", [uid, a.id]);
}
await showcase(B, "calf", { skin: "calf_strawberry", size: "large" });
await showcase(C, "bunny");

// A 가입, B·C·D를 이웃 + 즐겨찾기 (1·2·3번 자리)
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
errors.push(...collectErrors(page));
await loginDev(page, A);
const aId = await userId(A);
for (const [i, u] of [B, C, D].entries()) {
  await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite, town_lot) VALUES ($1, $2, true, $3)", [aId, await userId(u), i + 1]);
}
const canvas = page.locator("canvas");
const data = (k) => canvas.getAttribute(`data-${k}`);
const go = async (url = `${BASE}/town`) => {
  await page.goto(url);
  await canvas.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.feet, null, { timeout: 20000 });
};
const teleport = (key) => canvas.evaluate((c, k) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: k })), key);
/** 내 캐릭터 둘레를 잘라 찍는다 (발 위치 - 카메라) */
async function shotAroundMe(path, w = 240, h = 220) {
  const box = await canvas.boundingBox();
  const [fx, fy] = (await data("feet")).split(",").map(Number);
  const [cx, cy] = (await data("cam")).split(",").map(Number);
  await page.screenshot({ path, clip: { x: box.x + fx - cx - w / 2, y: box.y + fy - cy - h + 50, width: w, height: h } });
}

await go();
check("기본 마을 테마는 초원 (data-theme)", (await data("theme")) === "meadow" && (await page.locator("[data-town-theme]").getAttribute("data-town-theme")) === "meadow");
await teleport("stair:0:a");
await page.mouse.move(5, 5);

// ===== 가만히 동작 =====
{
  // 동작 이름과 그림 칸을 같은 순간에 읽는다 (화면이 느리면 짧은 동작은 금방 끝난다)
  const seen = await page
    .waitForFunction(() => {
      const d = document.querySelector("canvas")?.dataset;
      return d?.idle && d.idleFrame ? [d.idle, d.idleFrame] : null;
    }, null, { timeout: 12000 })
    .then((h) => h.jsonValue(), () => null);
  const [motion, frame] = seen ?? ["", ""];
  check("가만히 서 있으면 동작을 하나 한다 (data-idle)", !!motion, motion);
  check("동작 그림 칸이 보인다 (data-idle-frame)", !!frame && frame.startsWith(`${motion}:`), frame);
  // 움직이면 멈추는지 보려면 동작 중이어야 한다
  await canvas.evaluate((c) => c.dispatchEvent(new CustomEvent("bv-idle", { detail: "sit@2" })));
  await page.waitForFunction(() => !!document.querySelector("canvas")?.dataset.idle, null, { timeout: 5000 }).catch(() => {});
  await page.keyboard.down("ArrowLeft");
  // 다음 화면 한 장 안에 (이 컴퓨터는 한 장에 수백 ms)
  const stopped = await page
    .waitForFunction(() => {
      const d = document.querySelector("canvas")?.dataset;
      return d?.idle === "" && d.walk === "walk-left";
    }, null, { timeout: 2000 })
    .then(() => true, () => false);
  await page.keyboard.up("ArrowLeft");
  check("움직이면 바로 멈추고 걷는다", stopped, `${await data("idle")} / ${await data("walk")}`);

  // 동작마다 광장에서 찍기 (bv-idle로 바로 시작)
  // 이 컴퓨터는 화면이 느려(초당 몇 장) 동작의 대표 칸에서 멈춰 두고(@칸) 찍는다
  const PEAK = { wave: 2, jump: 3, stretch: 3, look: 3, sit: 4, heart: 3, music: 2, spin: 2 };
  for (const [m, f] of Object.entries(PEAK)) {
    await canvas.evaluate((c, k) => c.dispatchEvent(new CustomEvent("bv-idle", { detail: k })), `${m}@${f}`);
    await page.waitForFunction((want) => document.querySelector("canvas")?.dataset.idleFrame === want, `${m}:${f}`, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    await shotAroundMe(`${outDir}/idle-town-${m}.png`);
  }
  await page.keyboard.press("ArrowDown");
}

// ===== 이웃 말풍선 =====
{
  await teleport("stair:0:a");
  await page.waitForTimeout(400);
  check("즐겨찾기 이웃 3명이 마을을 걷는다 (data-npcs)", (await data("npcs")) === "3", await data("npcs"));
  check("전시 동물이 있는 이웃 2명은 동물을 데리고 다닌다 (data-npc-pets)", (await data("npc-pets")) === "2", await data("npc-pets"));
  // 이웃도 가끔 멈춰서 가만히 동작을 한다: 저절로 하는지 잠시 지켜보고, 스크린샷은 바로 시키기(bv-npc-act)로
  const natural = await page
    .waitForFunction(() => Number(document.querySelector("canvas")?.dataset.npcActing) > 0, null, { timeout: 45000 })
    .then(() => true, () => false);
  check("이웃(NPC)이 가끔 멈춰서 동작을 한다 (data-npc-acting)", natural, await data("npc-acting"));
  await canvas.evaluate((c) => c.dispatchEvent(new CustomEvent("bv-npc-come", { detail: 1 })));
  await page.waitForTimeout(1500);
  await canvas.evaluate((c) => c.dispatchEvent(new CustomEvent("bv-npc-act", { detail: "1:heart@3" })));
  await page.waitForTimeout(900);
  await shotAroundMe(`${outDir}/npc-pet-heart.png`, 480, 320);
  check("이웃에게 동작 시키기 → 동작 중", Number(await data("npc-acting")) >= 1, await data("npc-acting"));
  // B(1번, 마을 한마디)를 옆에 세우고 Space
  await canvas.evaluate((c) => c.dispatchEvent(new CustomEvent("bv-npc-come", { detail: 1 })));
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await page.waitForFunction(() => !!document.querySelector("canvas")?.dataset.npcSay, null, { timeout: 5000 }).catch(() => {});
  // 화면이 느려 스크린샷(1~2초) 사이에 말풍선이 사라질 수 있어, 먼저 읽고 찍는다
  const greet = [await data("npc-say"), await data("npc-say-lot")];
  await shotAroundMe(`${outDir}/npc-talk-greeting.png`, 420, 300);
  check("가까이서 Space → 마을 한마디 말풍선 (HTML은 글자 그대로)", greet[0] === GREETING && greet[1] === "1", greet.join(" / "));
  check("말풍선을 띄워도 페이지에 HTML이 생기지 않음", (await page.locator("canvas ~ b, [data-town-theme] b").count()) === 0);

  // C(2번, 한마디 없음): 누르면 공개 글의 한 문장. 여러 번 말 걸어도 비공개 글 문장은 안 나온다
  await page.waitForFunction(() => !document.querySelector("canvas")?.dataset.npcSay, null, { timeout: 9000 }).catch(() => {});
  // B는 그 자리에 서 있으니 다른 곳(계단 1번 끝)으로 옮겨 C를 부른다
  await teleport("stair:1:a");
  await page.waitForTimeout(400);
  const heard = new Set();
  for (let i = 0; i < 4; i++) {
    await canvas.evaluate((c) => c.dispatchEvent(new CustomEvent("bv-npc-come", { detail: 2 })));
    await page.waitForTimeout(200);
    if (i === 0) {
      // 마우스로 누르기 (이웃 그림 가운데)
      const box = await canvas.boundingBox();
      const [nx, ny] = (await data("npc-here")).split(",").map(Number);
      const [cx, cy] = (await data("cam")).split(",").map(Number);
      await page.mouse.click(box.x + nx - cx, box.y + ny - cy - 30);
    } else await page.keyboard.press("Space");
    await page.waitForFunction(() => !!document.querySelector("canvas")?.dataset.npcSay, null, { timeout: 5000 }).catch(() => {});
    const say = [await data("npc-say"), await data("npc-say-lot")];
    heard.add(say[0]);
    // 말풍선 스크린샷은 Space로 건 두 번째 말에서 (첫 번째는 바로 한 번 더 눌러 우체통을 시험)
    if (i === 1) await page.waitForTimeout(400);
    if (i === 1) await shotAroundMe(`${outDir}/npc-talk-post.png`, 420, 300);
    if (i === 0) {
      check("이웃을 마우스로 누르면 말풍선", PUBLIC_SENTENCES.includes(say[0]) && say[1] === "2", say.join(" / "));
      // 말풍선이 떠 있을 때 한 번 더 누르면 우체통
      const box = await canvas.boundingBox();
      const [nx, ny] = (await data("npc-here")).split(",").map(Number);
      const [cx, cy] = (await data("cam")).split(",").map(Number);
      await page.mouse.click(box.x + nx - cx, box.y + ny - cy - 30);
      const mailbox = await page.locator('[data-town-panel]').waitFor({ timeout: 5000 }).then(() => true, () => false);
      const panelText = mailbox ? await page.locator("[data-town-panel]").innerText() : "";
      check("말풍선이 떠 있는 이웃을 한 번 더 누르면 우체통", mailbox && panelText.includes("산책"), panelText.replace(/\n/g, " ").slice(0, 80));
      await page.keyboard.press("Escape");
    }
    await page.waitForFunction(() => !document.querySelector("canvas")?.dataset.npcSay, null, { timeout: 9000 }).catch(() => {});
  }
  const said = [...heard].filter(Boolean);
  check("한마디가 없으면 공개 글의 문장 (누르기·Space)", said.length > 0 && said.every((s) => PUBLIC_SENTENCES.includes(s)), said.join(" | "));
  check("말 걸 때마다 새로 고른다 (문장 둘 이상)", said.length >= 2, String(said.length));
  check("비공개 글 문장은 안 나온다", !said.some((s) => s.includes("비밀")));

  // 입구 안내가 떠 있으면 Space는 들어가기가 먼저 (상점 앞에 이웃을 세워도 상점으로)
  await teleport("shop");
  await page.waitForTimeout(400);
  await canvas.evaluate((c) => c.dispatchEvent(new CustomEvent("bv-npc-come", { detail: 1 })));
  await page.waitForTimeout(200);
  await page.keyboard.press("Space");
  await page.waitForURL(/\/shop/, { timeout: 10000 }).catch(() => {});
  check("입구 앞에서는 Space = 들어가기 (말 걸기보다 먼저)", page.url().includes("/shop"), page.url());
  // 상점의 배경 설명에 마을 이야기 (배경은 상점의 배경 탭, 2026-10-16)
  await page.locator('[data-shop-tab-button="background"]').click();
  const bgCard = page.getByText("꾸미면 마을에도 눈이 쌓이고");
  check("상점 배경 설명: 마을도 바뀐다고 안내", await bgCard.first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await page.screenshot({ path: `${outDir}/shop-backgrounds.png`, fullPage: true });
}

// ===== 마을 테마 (꾸미기 배경) =====
const giveBg = async (uid, code) => {
  await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code = $2 ON CONFLICT DO NOTHING", [uid, code]);
  await db.query("UPDATE blogs SET background_item_id = (SELECT id FROM items WHERE code = $2) WHERE owner_id = $1", [uid, code]);
};
const WEATHER = { meadow: "", beach: "glints", snow: "snow", sakura: "petals", night: "fireflies", space: "stars" };
for (const key of ["snow", "space", "sakura", "night", "beach", "meadow"]) {
  await giveBg(aId, `bg_${key}`);
  await go();
  await teleport("plaza");
  await page.waitForTimeout(1500);
  const theme = await data("theme");
  check(`배경 ${key} → 마을 테마 ${key} (날씨 ${WEATHER[key] || "없음"})`, theme === key && (await data("weather")) === WEATHER[key], `${theme} / ${await data("weather")}`);
  await page.screenshot({ path: `${outDir}/town-${key}.png` });
}
// 친구 마을은 그 주인(B)의 배경을 따른다
await giveBg(await userId(B), "bg_snow");
await giveBg(aId, "bg_space");
await go(`${BASE}/town/${B}`);
check("친구 마을은 주인의 배경 테마 (B = 눈 마을)", (await data("theme")) === "snow", await data("theme"));
await page.screenshot({ path: `${outDir}/town-friend-snow.png` });

// ===== 우리 집 방: 주인 캐릭터도 쉬는 동안 가끔 동작 =====
{
  await page.goto(`${BASE}/@${A}`);
  const me = page.locator("[data-room-resident]");
  await me.waitFor();
  const acted = await page
    .waitForFunction(() => !!document.querySelector("[data-room-resident]")?.dataset.idle, null, { timeout: 30000 })
    .then(() => true, () => false);
  check("우리 집 방 주인도 쉬는 동안 동작을 한다 (data-idle)", acted, (await me.getAttribute("data-idle")) ?? "");
  if (acted) await page.locator("[data-house-room]").screenshot({ path: `${outDir}/room-idle.png` });
}

// ===== 움직임 줄이기: 가만히 동작·날씨 없음 =====
{
  const r = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const rp = await r.newPage();
  errors.push(...collectErrors(rp));
  await loginDev(rp, A);
  await rp.goto(`${BASE}/town`);
  await rp.locator("canvas").waitFor();
  await rp.waitForTimeout(6000);
  const c = rp.locator("canvas");
  check("움직임 줄이기: 가만히 동작 없음", (await c.getAttribute("data-idle")) === "", await c.getAttribute("data-idle"));
  check("움직임 줄이기: 날씨 알갱이 없음 (테마 색은 그대로)", (await c.getAttribute("data-weather")) === "" && (await c.getAttribute("data-theme")) === "space");
  await r.close();
}

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
