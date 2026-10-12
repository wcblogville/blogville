// 우리 집 가구 크기·누르면 걷기·가구와 놀기 (사용자 요청 2026-10-12
// "가구마다 크기 다르게 해줘 침대같은 경우는 사람보다 컸으면 좋겠어 그리고 방에서 혼자 막 돌아다니는 것 보다 사용자가 클릭했을 때 이동하게 해주고 가구들이랑 상호작용하는거 넣어줘")
// 1) 가구 놓기: 침대(3×2칸)를 넣으면 여러 칸을 차지하고, 침대 칸에 의자를 끌면 막힘, 뒤집으면 2×3, 저장 → 새로 고쳐도 그대로
// 2) 예전 1칸 배치가 겹치면 읽을 때 빈 자리로 옮겨 보여 주고, 주인이 저장하면 DB도 고쳐진다
// 3) 혼자 돌아다니지 않는다 → 바닥을 누르면 그 칸까지 걷는다 (방문자도, 저장 안 함)
// 4) 침대를 누르면 옆으로 걸어가 눕는다(쿨쿨), 소파는 앉기, 화분은 물 주기, 스탠드는 불 켜고 끄기, 옷장은 한 바퀴
// 5) 움직임 줄이기면 걷지 않고 바로 옮긴다, 휴대폰은 톡 하면 같게
// 사용: 개발 서버를 띄운 상태에서 node e2e/room-interact.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev, roomTileCenter } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
process.on("uncaughtException", (e) => {
  console.log(results.join("\n"));
  console.error(e);
  process.exit(1);
});

const browser = await chromium.launch();
const H = `ri${Date.now() % 100_000_000}`;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, H);
const uid = (await one("SELECT id FROM users WHERE username = $1", [H])).id;
// Lv.30 → 4단계: 가구 8개, 방 9×9칸. 침대·소파·스탠드·옷장을 가진다
await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', $2, 0)", [uid, 10 * 30 * 29]);
await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code = ANY($2) ON CONFLICT DO NOTHING", [uid, ["fur_bed", "fur_sofa", "fur_lamp", "fur_wardrobe"]]);
const placed = async () =>
  (await db.query("SELECT h.tile_x, h.tile_y, h.flipped, i.code FROM house_furniture h JOIN items i ON i.id = h.item_id WHERE h.user_id = $1 ORDER BY i.code", [uid])).rows
    .map((r) => `${r.tile_x},${r.tile_y}:${r.code}${r.flipped ? "~" : ""}`)
    .join(" ");

const room = page.locator("[data-house-room]");
const piece = (code, pg = page) => pg.locator(`[data-house-room] [data-furniture="furniture.${code}"]`);
const me = (pg = page) => pg.locator("[data-house-room] [data-room-resident]");
const tileOf = (code, pg = page) => piece(code, pg).getAttribute("data-tile");
const shot = (name, pg = page) => pg.locator("[data-house-room]").screenshot({ path: `${outDir}/${name}.png` });
/** 가구의 뒤 모서리 칸을 잡아 (x, y) 칸으로 끈다 */
const dragTo = async (code, x, y) => {
  const [fx, fy] = (await tileOf(code)).split(",").map(Number);
  const from = await roomTileCenter(page, fx, fy);
  const to = await roomTileCenter(page, x, y);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
};
const save = async () => {
  await room.getByRole("button", { name: /저장/ }).click();
  await room.locator("[data-furniture-tray]").waitFor({ state: "detached", timeout: 15000 });
};
/** 가구 그림 위 한 점(가로·세로 비율)을 누른다 (방은 누른 곳의 그림 도트로 가구를 찾는다) */
const tapPiece = async (code, fx = 0.5, fy = 0.6, pg = page, touch = false) => {
  const b = await piece(code, pg).boundingBox();
  const x = b.x + b.width * fx;
  const y = b.y + b.height * fy;
  if (touch) await pg.touchscreen.tap(x, y);
  else await pg.mouse.click(x, y);
};
const waitPose = (pose, pg = page, timeout = 12000) =>
  pg.waitForFunction((p) => document.querySelector("[data-room-resident]")?.dataset.pose === p, pose, { timeout }).then(() => true, () => false);
const waitTile = (t, pg = page, timeout = 12000) =>
  pg.waitForFunction((t) => {
    const el = document.querySelector("[data-room-resident]");
    return el?.dataset.tile === t && el.dataset.walk.startsWith("idle");
  }, t, { timeout }).then(() => true, () => false);

// ===== 1) 가구 크기: 침대 3×2칸 =====
await page.goto(`${BASE}/@${H}`);
await room.locator("[data-room-grid][data-room-dot]").waitFor();
check("4단계 방 9×9칸, 가구 8개까지", (await room.locator("[data-furniture-count]").innerText()).includes("방 9×9칸"));
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
// 기본 화분(0,1)은 먼저 앞쪽(0,7)으로 옮겨 둔다 (뒤에 두면 큰 침대 머리판에 가려 잡기 어렵다)
await dragTo("plant", 0, 7);
await dragTo("chair", 6, 6);
check("가진 가구 목록에 크기 (침대 3×2칸, 소파 2×1칸)", (await room.getByRole("button", { name: /포근한 침대/ }).innerText()).includes("3×2칸") && (await room.getByRole("button", { name: /푹신한 소파/ }).innerText()).includes("2×1칸"));
await room.getByRole("button", { name: /포근한 침대/ }).click();
const bedTile = await tileOf("bed");
check("목록에서 누르면 침대가 들어갈 빈 자리(뒤 모서리, 3×2칸)에 놓임", (await piece("bed").getAttribute("data-size")) === "3x2" && bedTile === "0,0", `${bedTile} ${await piece("bed").getAttribute("data-size")}`);
check("편집: 침대가 차지하는 칸(3×2) 표시", (await room.locator('[data-footprint="furniture.bed:3x2"]').count()) === 1);
// 침대를 (2,3)으로 옮기고, 의자(6,6)를 침대가 차지한 칸(3,4)으로 끌면 막힌다
await dragTo("bed", 2, 3);
check("침대 끌어 옮기기 (2,3)", (await tileOf("bed")) === "2,3", await tileOf("bed"));
await dragTo("chair", 3, 4);
check("침대가 차지한 칸(3,4)에는 의자를 못 놓음 (안내, 의자 그대로)", (await tileOf("chair")) === "6,6" && (await room.getByRole("alert").innerText()).includes("이미 가구가"), await tileOf("chair"));
await dragTo("bed", 7, 0);
check("침대 끝이 방 밖으로 나가면 못 놓음 (7,0 → 7~9칸)", (await tileOf("bed")) === "2,3" && (await room.getByRole("alert").innerText()).includes("방 밖"));
const bedButton = room.locator(`[data-furniture="furniture.bed"] button`);
await bedButton.focus();
await page.keyboard.press("f");
check("F로 뒤집으면 2×3칸", (await piece("bed").getAttribute("data-size")) === "2x3" && (await piece("bed").getAttribute("data-flip")) === "1");
await page.keyboard.press("f");
await shot("01-edit-bed-3x2");
await save();
const after = await placed();
check("[저장] → 침대 2,3 (3×2칸), 의자 6,6", after.includes("2,3:fur_bed") && after.includes("6,6:fur_chair"), after);
await page.reload();
await room.locator("[data-room-grid][data-room-dot]").waitFor();
check("새로 고쳐도 침대 3×2칸 그대로", (await tileOf("bed")) === "2,3" && (await piece("bed").getAttribute("data-size")) === "3x2");
const bedBox = await piece("bed").boundingBox();
const meBox = await me().boundingBox();
check("침대 그림이 사람보다 크다 (너비 1.5배 넘게)", bedBox.width > meBox.width * 1.5, `${Math.round(bedBox.width)} vs ${Math.round(meBox.width)}`);

// 나머지 가구를 놓는다: 소파 6,0 · 스탠드 0,3 · 옷장 8,4
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
// 하나씩 넣고 바로 옮긴다 (뒤 모서리에 쌓이면 키 큰 그림이 뒤 가구를 가린다)
for (const [name, code, x, y] of [[/푹신한 소파/, "sofa", 6, 0], [/스탠드 조명/, "lamp", 0, 3], [/옷장/, "wardrobe", 8, 4]]) {
  await room.getByRole("button", { name }).click();
  await dragTo(code, x, y);
}
await save();
{
  const six = await placed();
  check("가구 6개 저장 (소파 6,0 · 스탠드 0,3 · 옷장 8,4 · 화분 0,7)", ["6,0:fur_sofa", "0,3:fur_lamp", "8,4:fur_wardrobe", "0,7:fur_plant"].every((t) => six.includes(t)), six);
}
await page.reload();
await room.locator("[data-room-grid][data-room-dot]").waitFor();
await page.waitForTimeout(500);
await shot("02-furniture-sizes-1280");

// ===== 3) 누르면 걷는다 =====
{
  const start = await me().getAttribute("data-tile");
  await page.waitForTimeout(2500);
  check("혼자 돌아다니지 않는다 (2.5초 뒤에도 처음 칸, idle)", (await me().getAttribute("data-tile")) === start && (await me().getAttribute("data-walk")).startsWith("idle"), start);
  const t = await roomTileCenter(page, 6, 7);
  await page.mouse.click(t.x, t.y);
  const walking = await page.waitForFunction(() => document.querySelector("[data-room-resident]")?.dataset.walk.startsWith("walk-"), null, { timeout: 3000 }).then(() => true, () => false);
  check("바닥 칸을 누르면 걷기 시작 (walk-…)", walking);
  check("누른 칸(6,7)에 도착해 멈춤", await waitTile("6,7"), await me().getAttribute("data-tile"));
  await shot("03-clicked-tile-1280");
}

// ===== 4) 가구와 놀기 =====
await tapPiece("bed", 0.5, 0.55);
check("침대를 누르면 걸어가서 눕는다 (data-pose=sleep)", await waitPose("sleep"));
await page.waitForTimeout(1200);
check("누운 몸짓이 보이고 걷기 그림은 숨는다", (await room.locator("[data-room-pose]").evaluate((el) => getComputedStyle(el).visibility)) === "visible" && (await me().evaluate((el) => getComputedStyle(el).visibility)) === "hidden");
check("쿨쿨 Z 효과", await room.locator("[data-room-fx] span").first().evaluate((el) => el.style.backgroundImage.startsWith("url")));
await shot("04-bed-sleep-1280");
await tapPiece("sofa");
check("소파 → 앉기 (sit)", await waitPose("sit"));
await page.waitForTimeout(500);
await shot("05-sofa-sit-1280");
await tapPiece("plant", 0.5, 0.5);
check("화분 → 물 주기 (water)", await waitPose("water"));
await page.waitForTimeout(600);
await shot("06-plant-water-1280");
await tapPiece("lamp", 0.5, 0.3);
check("스탠드 → 불 (light), 방이 어두워지고 스탠드 둘레만 환함", (await waitPose("light")) && (await room.locator("[data-room-light]").getAttribute("data-light")) === "on");
await page.waitForTimeout(700);
await shot("07-lamp-light-1280");
await page.waitForTimeout(1200);
await tapPiece("lamp", 0.5, 0.3);
await waitPose("light");
check("스탠드를 다시 누르면 불이 돌아옴", (await room.locator("[data-room-light]").getAttribute("data-light")) === "off");
await tapPiece("wardrobe", 0.4, 0.5);
check("옷장 → 옷 갈아입고 한 바퀴 (spin)", await waitPose("spin"));
await page.waitForTimeout(500);
await shot("08-wardrobe-spin-1280");
await tapPiece("chair", 0.5, 0.6);
check("의자 → 앉기 (sit)", await waitPose("sit"));
await page.waitForTimeout(500);
await shot("09-chair-sit-1280");
{
  // 키보드: 가구 단추에 초점을 두고 Enter
  await room.locator(`[data-furniture="furniture.bed"] button`).focus();
  await page.keyboard.press("Enter");
  check("키보드: 침대 단추 Enter → 눕기", await waitPose("sleep"));
}

// ===== 2) 예전 1칸 배치가 겹치면 고쳐 읽기 =====
{
  // 옛 배치처럼 DB에 직접: 침대 2,3(3×2)과 겹치는 3,4에 의자
  await db.query("UPDATE house_furniture SET tile_x = 3, tile_y = 4 WHERE user_id = $1 AND item_id = (SELECT id FROM items WHERE code = 'fur_chair')", [uid]);
  const g = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const gp = await g.newPage();
  errors.push(...collectErrors(gp));
  await gp.goto(`${BASE}/@${H}`);
  await gp.locator("[data-house-room] [data-room-grid][data-room-dot]").waitFor();
  const chairAt = await tileOf("chair", gp);
  check("겹친 옛 배치: 방문자에게는 의자를 빈 자리로 옮겨 보여 줌 (DB는 그대로)", chairAt !== "3,4" && (await placed()).includes("3,4:fur_chair"), chairAt);
  // 방문자도 눌러서 움직일 수 있다 (저장하지 않음)
  const t = await roomTileCenter(gp, 5, 7);
  await gp.mouse.click(t.x, t.y);
  check("방문자도 바닥을 누르면 걷는다 (5,7)", await waitTile("5,7", gp), await me(gp).getAttribute("data-tile"));
  await tapPiece("bed", 0.5, 0.55, gp);
  check("방문자도 침대를 누르면 눕는다", await waitPose("sleep", gp));
  await g.close();
  await page.reload();
  await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
  check("주인 편집: 옮긴 가구 안내", (await room.getByRole("status").innerText()).includes("빈 자리로 옮겼어요"));
  await save();
  check("주인이 저장하면 DB도 고쳐짐 (의자가 침대 칸 밖)", !(await placed()).includes("3,4:fur_chair"), await placed());
}

// ===== 5) 움직임 줄이기 · 휴대폰 =====
{
  const r = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const rp = await r.newPage();
  errors.push(...collectErrors(rp));
  await rp.goto(`${BASE}/@${H}`);
  await rp.locator("[data-house-room] [data-room-grid][data-room-dot]").waitFor();
  const t = await roomTileCenter(rp, 5, 7);
  await rp.mouse.click(t.x, t.y);
  await rp.waitForTimeout(150);
  check("움직임 줄이기: 걷지 않고 바로 그 칸 (0.15초 안)", (await me(rp).getAttribute("data-tile")) === "5,7" && (await me(rp).getAttribute("data-walk")).startsWith("idle"), await me(rp).getAttribute("data-tile"));
  await tapPiece("bed", 0.5, 0.55, rp);
  check("움직임 줄이기: 침대 → 바로 눕기", await waitPose("sleep", rp, 1500));
  await r.close();
}
{
  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  errors.push(...collectErrors(mp));
  await loginDev(mp, H);
  await mp.goto(`${BASE}/@${H}`);
  await mp.locator("[data-house-room] [data-room-grid][data-room-dot]").waitFor();
  await mp.waitForTimeout(500);
  await shot("10-furniture-sizes-375", mp);
  const t = await roomTileCenter(mp, 4, 7);
  await mp.touchscreen.tap(t.x, t.y);
  check("375px: 톡 하면 그 칸으로 걷는다 (4,7)", await waitTile("4,7", mp), await me(mp).getAttribute("data-tile"));
  await shot("11-tap-move-375", mp);
  await tapPiece("bed", 0.5, 0.55, mp, true);
  check("375px: 침대 톡 → 눕기", await waitPose("sleep", mp));
  await mp.waitForTimeout(900);
  await shot("12-bed-sleep-375", mp);
  await tapPiece("lamp", 0.5, 0.3, mp, true);
  check("375px: 스탠드 톡 → 불", (await waitPose("light", mp)) && (await mp.locator("[data-room-light]").getAttribute("data-light")) === "on");
  await mp.waitForTimeout(600);
  await shot("13-lamp-375", mp);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("375px 가로 스크롤 없음", overflow <= 0, String(overflow));
  await m.close();
}

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
