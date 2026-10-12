// 마을 개편 2차 (사용자 요청 2026-10-08): 블로그의 "우리 집" 구역(가구 놓기, 🚪 문), 집 단계별 가구 수, 상점 가구
// 2026-10-12 정육면체 방·가구 자유 배치: 끌어 놓기(칸에 붙음)·겹침 막기·방향키·뒤집기·빼기·취소·저장 → 새로 고쳐도 그 자리,
// 개수 제한(화면·서버), 방 크기(집 단계), 방문자는 저장된 배치만, 전시 동물이 끊기지 않고 따라오는지
// 첫 가입 → 블로그 → 문 → 마을은 e2e/auth.mjs 1)이 확인한다
// 사용: 개발 서버를 띄운 상태에서 node e2e/house.mjs <스크린샷 폴더>
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
// 중간에 멈춰도 그때까지의 결과를 보여 준다
process.on("uncaughtException", (e) => {
  console.log(results.join("\n"));
  console.error(e);
  process.exit(1);
});
const browser = await chromium.launch();
const H = `hs${Date.now() % 100_000_000}`;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, H);
const uid = (await one("SELECT id FROM users WHERE username = $1", [H])).id;
// 저장된 배치: "x,y:코드" (뒤집으면 끝에 ~), 칸 순서
const placed = async () =>
  (await db.query("SELECT h.tile_x, h.tile_y, h.flipped, i.code FROM house_furniture h JOIN items i ON i.id = h.item_id WHERE h.user_id = $1 ORDER BY tile_x, tile_y", [uid])).rows
    .map((r) => `${r.tile_x},${r.tile_y}:${r.code}${r.flipped ? "~" : ""}`)
    .join(" ");

// 가입하면 기본 가구 2개 (화분·나무 의자)
const starters = (await db.query("SELECT i.code FROM user_items u JOIN items i ON i.id = u.item_id WHERE u.user_id = $1 AND i.type = 'furniture' ORDER BY i.code", [uid])).rows.map((r) => r.code);
check("가입하면 기본 가구 화분·나무 의자", starters.join(",") === "fur_chair,fur_plant", starters.join(","));

// 우리 집: 1단계 4칸
await page.goto(`${BASE}/@${H}`);
const room = page.locator("[data-house-room]");
const head = await room.innerText();
check("우리 집: 1단계 작은 오두막, 기본 가구 2/4개, 방 6×6칸, Lv.10에 커짐", head.includes("1단계 작은 오두막") && head.includes("가구 2/4개") && head.includes("방 6×6칸") && head.includes("Lv.10에 집이 커져요"), head.split("\n").slice(0, 3).join(" "));
check("가입하면 기본 가구가 기본 자리(화분 0,1 · 의자 2,0)에 놓여 있음", (await placed()) === "0,1:fur_plant 2,0:fur_chair", await placed());
check("방 그림: 아이소메트릭 상자 6×6 (바닥 칸 64×32px)", (await room.locator("[data-room-grid]").getAttribute("data-room-grid")) === "6" && (await room.locator("[data-room-grid]").getAttribute("data-tile-size")) === "64,32");

// 지붕 색 (TOWN-07): 1단계는 처음 받은 무작위 색 1개만 열려 있고 9개는 잠김
const roofButton = room.getByRole("button", { name: "🏠 지붕 색" });
const roofPicker = room.locator("[data-roof-picker]");
await roofButton.click();
const openRoofs = async () => roofPicker.locator("[data-roof]").evaluateAll((els) => els.map((e) => e.getAttribute("data-roof")));
const firstRoofs = await openRoofs();
check("1단계 지붕 색: 1개 열림, 9개 잠김", firstRoofs.length === 1 && (await roofPicker.getByText("🔒").count()) === 9, firstRoofs.join(","));
check("안 고른 지붕은 처음 색이 선택됨", (await roofPicker.locator('[data-roof][aria-pressed="true"]').count()) === 1);
await page.screenshot({ path: `${outDir}/house-roof-1.png` });
await room.getByRole("button", { name: /다 골랐어요/ }).click();
await page.waitForTimeout(1500);
await room.screenshot({ path: `${outDir}/01-room-1280.png` });

// ===== 가구 놓기 (편집): 끌어 놓기 · 겹침 막기 · 방향키 · 뒤집기 · 빼기 · 취소 · 저장 =====
/** 바닥 칸 (x, y) 가운데의 화면 좌표 (줄인 배율 포함) */
const tileCenter = async (x, y, pg = page) =>
  pg.locator("[data-house-room] [data-room-grid]").evaluate(
    (el, [x, y]) => {
      const r = el.getBoundingClientRect();
      const k = r.width / el.offsetWidth;
      const [ox, oy] = el.dataset.origin.split(",").map(Number);
      const [tw, th] = el.dataset.tileSize.split(",").map(Number);
      return { x: r.left + (ox + ((x - y) * tw) / 2) * k, y: r.top + (oy + ((x + y + 1) * th) / 2) * k };
    },
    [x, y],
  );
const piece = (code, pg = page) => pg.locator(`[data-house-room] [data-furniture="furniture.${code}"]`);
const tileOf = async (code, pg = page) => piece(code, pg).getAttribute("data-tile");
/** 가구를 끌어 (x, y) 칸에 놓는다. 손가락이 가구 위 어디를 잡든 같은 만큼 옮긴다. shot이면 놓기 전에 찍는다 */
const dragTo = async (code, x, y, shot, pg = page) => {
  const [fx, fy] = (await tileOf(code, pg)).split(",").map(Number);
  const from = await tileCenter(fx, fy, pg);
  const to = await tileCenter(x, y, pg);
  const box = await piece(code, pg).locator("button").boundingBox();
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height * 0.6;
  await pg.mouse.move(sx, sy);
  await pg.mouse.down();
  await pg.mouse.move(sx + (to.x - from.x) / 2, sy + (to.y - from.y) / 2, { steps: 5 });
  await pg.mouse.move(sx + to.x - from.x, sy + to.y - from.y, { steps: 5 });
  if (shot) await pg.locator("[data-house-room]").screenshot({ path: shot });
  await pg.mouse.up();
};
const save = async (pg = page) => {
  await pg.locator("[data-house-room]").getByRole("button", { name: /저장/ }).click();
  await pg.locator("[data-furniture-tray]").waitFor({ state: "detached", timeout: 10000 });
};
const countText = async () => (await room.locator("[data-furniture-count]").innerText()).trim();

await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
check("편집: 바닥 칸 눈금·가진 가구 목록·[저장]·[취소]", (await room.locator("[data-furniture-tray]").isVisible()) && (await room.getByRole("button", { name: /저장/ }).isVisible()) && (await room.getByRole("button", { name: /취소/ }).isVisible()));
check("편집 중에는 캐릭터가 숨는다 (가구를 가리지 않게)", !(await room.locator("[data-room-resident]").isVisible()));

// 취소: 옮겨도 저장하지 않으면 처음 자리로
await dragTo("chair", 4, 4);
check("끌어 놓기 → 칸에 붙음 (의자 2,0 → 4,4)", (await tileOf("chair")) === "4,4", await tileOf("chair"));
check("저장 전에는 DB 그대로", (await placed()) === "0,1:fur_plant 2,0:fur_chair", await placed());
await room.getByRole("button", { name: /취소/ }).click();
check("[취소] → 처음 배치로", (await tileOf("chair")) === "2,0" && (await room.locator("[data-furniture-tray]").count()) === 0, await tileOf("chair"));

// 저장: 의자를 3,3으로 끌기(끄는 중 화면), 화분을 의자 칸에 끌면 막힘, 방향키·F로 화분 옮기고 뒤집기
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
await dragTo("chair", 3, 3, `${outDir}/03-edit-dragging.png`);
check("끄는 중 놓을 칸이 초록으로 표시됨 (스크린샷)", (await tileOf("chair")) === "3,3", await tileOf("chair"));
await dragTo("plant", 3, 3);
check("다른 가구가 있는 칸에는 못 놓음 (화분 그대로 0,1, 안내)", (await tileOf("plant")) === "0,1" && (await room.getByRole("alert").innerText()).includes("이미 가구가"), await tileOf("plant"));
await dragTo("plant", 9, 9);
check("방 밖에 놓으면 제자리 (안내)", (await tileOf("plant")) === "0,1" && (await room.getByRole("alert").innerText()).includes("방 밖"));
await piece("plant").locator("button").focus();
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowDown");
await page.keyboard.press("f");
check("키보드: 방향키로 한 칸씩 (0,1 → 1,2), F로 뒤집기", (await tileOf("plant")) === "1,2" && (await piece("plant").getAttribute("data-flip")) === "1", await tileOf("plant"));
await page.keyboard.press("ArrowUp");
await page.keyboard.press("ArrowUp");
await page.keyboard.press("ArrowUp");
check("키보드: 방 밖으로는 안 나감 (1,0에서 멈춤)", (await tileOf("plant")) === "1,0", await tileOf("plant"));
await save();
check("[저장] → DB에 칸·뒤집기 저장", (await placed()) === "1,0:fur_plant~ 3,3:fur_chair", await placed());
await page.reload();
await room.locator("[data-room-resident]").waitFor();
check("새로 고쳐도 그 자리", (await tileOf("chair")) === "3,3" && (await tileOf("plant")) === "1,0" && (await piece("plant").getAttribute("data-flip")) === "1");
await page.waitForTimeout(1500);
await room.screenshot({ path: `${outDir}/04-after-save.png` });

// 빼기: 고른 가구 [📦 빼기] → 저장하면 사라짐, 목록에서 누르면 빈 칸에 다시 놓임
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
await piece("plant").locator("button").click();
await room.getByRole("button", { name: /빼기/ }).click();
check("[📦 빼기] → 방에서 빠지고 목록에 `＋ 놓기`", (await piece("plant").count()) === 0 && (await room.locator("[data-furniture-tray]").innerText()).includes("＋ 놓기"));
await room.getByRole("button", { name: /초록 화분/ }).click();
check("목록에서 누르면 빈 칸에 놓임 (뒤 모서리 0,0)", (await tileOf("plant")) === "0,0", await tileOf("plant"));
await save();
check("다시 저장 (화분 0,0)", (await placed()) === "0,0:fur_plant 3,3:fur_chair", await placed());

// DB가 남의 가구·방 밖 칸·한 칸에 둘을 막는다
const blocked = async (q, p) => db.query(q, p).then(() => false, () => true);
check(
  "DB: 갖지 않은 가구는 못 놓음",
  await blocked("INSERT INTO house_furniture (user_id, item_id, tile_x, tile_y) SELECT $1, id, 5, 5 FROM items WHERE code = 'fur_sofa'", [uid]),
);
check("DB: 방 밖 칸(10)은 못 놓음", await blocked("UPDATE house_furniture SET tile_x = 10 WHERE user_id = $1", [uid]));
check("DB: 한 칸에 가구 둘은 못 놓음 (house_furniture_tile_uq)", await blocked("UPDATE house_furniture SET tile_x = 3, tile_y = 3 WHERE user_id = $1", [uid]));

// 상점 가구: 둥근 탁자 사기 → 가구 놓기 목록에 생김
await page.goto(`${BASE}/shop`);
const table = page.locator("article", { hasText: "둥근 탁자" });
check("상점에 🛋 가구", await page.getByRole("heading", { name: /가구/ }).isVisible());
await table.getByRole("button", { name: "사기" }).click();
await page.getByRole("status").waitFor();
check("가구 산 안내", (await page.getByRole("status").innerText()).includes("우리 집"));

// 가구를 더 가진 채로 (DB): 러그·스툴·선인장·과일 상자 → 가진 가구 7개
await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code = ANY($2) ON CONFLICT DO NOTHING", [uid, ["fur_rug", "fur_stool", "fur_cactus", "fur_crate"]]);
const unplacedButtons = () => room.locator('[data-furniture-tray] button[data-owned][aria-pressed="false"]');
await page.goto(`${BASE}/@${H}`);
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
await unplacedButtons().first().click();
await unplacedButtons().first().click();
const disabled = await unplacedButtons().evaluateAll((els) => els.map((e) => e.disabled));
check("1단계는 4개까지: 4/4개가 되면 나머지 가구는 못 더함", (await countText()).includes("가구 4/4개") && disabled.length === 3 && disabled.every(Boolean), `${await countText()} ${disabled}`);
await room.getByRole("button", { name: /취소/ }).click();

// 레벨 10 → 2단계: 6개, 방 7×7 (레벨 n까지 10 × n × (n − 1), src/lib/game.ts)
const expFor = (lv) => 10 * lv * (lv - 1);
const setExp = async (target) => {
  const { exp } = await one("SELECT COALESCE(SUM(exp_delta), 0)::int AS exp FROM point_ledger WHERE user_id = $1", [uid]);
  if (target > exp) return (await one("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', $2, 0) RETURNING id", [uid, target - exp])).id;
  return null;
};
const bonus = await setExp(expFor(10));
await page.goto(`${BASE}/@${H}`);
check("Lv.10 → 2단계 창문 많은 집, 6개, 방 7×7칸", (await room.innerText()).includes("2단계 창문 많은 집") && (await countText()).includes("/6개") && (await countText()).includes("방 7×7칸"), await countText());
check("2단계: Lv.20에 다음 단계", (await room.innerText()).includes("Lv.20에 집이 커져요"));

// 2단계 → 지붕 색 하나 더 열림. 새 색을 고르면 저장된다
await room.getByRole("button", { name: "🏠 지붕 색" }).click();
const secondRoofs = await openRoofs();
check("2단계 지붕 색: 2개 열림 (처음 색 + 1)", secondRoofs.length === 2 && secondRoofs[0] === firstRoofs[0], secondRoofs.join(","));
await roofPicker.locator(`[data-roof="${secondRoofs[1]}"]`).click();
await roofPicker.locator(`[data-roof="${secondRoofs[1]}"][aria-pressed="true"]`).waitFor({ timeout: 10000 }).catch(() => {});
const savedRoof = (await one("SELECT roof_color FROM blogs WHERE owner_id = $1", [uid])).roof_color;
check("새 지붕 색 저장", savedRoof === secondRoofs[1], String(savedRoof));
await page.screenshot({ path: `${outDir}/house-roof-2.png` });
await room.getByRole("button", { name: /다 골랐어요/ }).click();

// 2단계 편집: 탁자를 넣어 7×7 방의 맨 앞 칸(6,6)으로, 가구 6개 저장
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
await room.getByRole("button", { name: /둥근 탁자/ }).click();
await dragTo("table", 6, 6);
for (let i = 0; i < 3; i++) await unplacedButtons().first().click();
check("2단계: 6/6개", (await countText()).includes("가구 6/6개"), await countText());
await save();
const six = await placed();
check("2단계: 7×7 방 맨 앞 칸(6,6)에 탁자, 가구 6개 저장", six.includes("6,6:fur_table") && six.split(" ").length === 6, six);

// 서버도 개수를 다시 센다: 화면은 2단계(6개)인데 그사이 레벨이 1단계로 내려갔다고 치면 저장을 막는다 (원장 행을 잠깐 지움)
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
await db.query("DELETE FROM point_ledger WHERE id = $1", [bonus]);
await room.getByRole("button", { name: /저장/ }).click();
await room.getByRole("alert").waitFor({ timeout: 10000 });
check("서버: 집 단계보다 많은 가구는 저장 막음 (4개까지 안내, DB 그대로)", (await room.getByRole("alert").innerText()).includes("4개까지") && (await placed()) === six, await room.getByRole("alert").innerText());
await room.getByRole("button", { name: /취소/ }).click();
await setExp(expFor(10));

// 방문자: 저장된 자리에 가구가 보이고, 가구 놓기 버튼은 없음. 문 → 마을의 이 집 앞
{
  const g = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const gp = await g.newPage();
  errors.push(...collectErrors(gp));
  await gp.goto(`${BASE}/@${H}`);
  const groom = gp.locator("[data-house-room]");
  const shown = await groom.locator("[data-furniture]").evaluateAll((els) => els.length);
  check("방문자에게 가구 6개 보임, 탁자는 저장된 칸(6,6)", shown === 6 && (await tileOf("table", gp)) === "6,6", `${shown} ${await tileOf("table", gp)}`);
  check("방문자에게 가구 놓기 없음", (await groom.getByRole("button", { name: /가구 놓기/ }).count()) === 0);
  check("문 주소 = /town?at=주소", (await groom.locator("[data-house-door]").getAttribute("href")) === `/town?at=${H}`);
  await gp.screenshot({ path: `${outDir}/house-visitor.png` });
  await g.close();
}
// 다른 회원도 남의 집은 고칠 수 없다 (버튼 없음, 저장은 늘 내 집만 바꾼다)
{
  const o = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const op = await o.newPage();
  errors.push(...collectErrors(op));
  await loginDev(op, `${H}o`);
  await op.goto(`${BASE}/@${H}`);
  check("다른 회원에게 남의 집 가구 놓기 없음", (await op.locator("[data-house-room]").getByRole("button", { name: /가구 놓기/ }).count()) === 0 && (await op.locator("[data-house-room] [data-furniture]").count()) === 6);
  await o.close();
}

// 큰 집: Lv.50 → 5단계, 방 10×10, 가구 8개
await setExp(expFor(50));
await page.goto(`${BASE}/@${H}`);
check("5단계: 방 10×10칸, 가구 8개까지", (await countText()).includes("방 10×10칸") && (await countText()).includes("/8개"), await countText());
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
await unplacedButtons().first().click();
await dragTo("table", 9, 9);
await dragTo("chair", 6, 2);
await save();
check("5단계: 맨 앞 칸(9,9)에 놓고 저장", (await placed()).includes("9,9:fur_table"), await placed());
await page.waitForTimeout(1500);
await room.screenshot({ path: `${outDir}/05-stage5-10x10.png` });

// 전시 동물: 주인을 따라 걸을 때 멈칫거리지 않는다 (걷기 ↔ 서기가 프레임마다 뒤바뀌지 않고, 한 프레임에 크게 튀지 않음)
{
  const animal = await one(
    `INSERT INTO user_animals (user_id, sex, species_id, status, growth, source, hatched_at, grown_at)
     VALUES ($1, 'female', (SELECT id FROM animal_species WHERE code = 'puppy'), 'grown', 0, 'shop', now(), now()) RETURNING id`,
    [uid],
  );
  await db.query("UPDATE blogs SET showcase_animal_id = $2 WHERE owner_id = $1", [uid, animal.id]);
  await page.goto(`${BASE}/@${H}`);
  await room.locator("[data-showcase]").waitFor();
  await page.waitForFunction(() => document.querySelector("[data-room-resident]")?.dataset.walk?.startsWith("walk-"), null, { timeout: 12000 }).catch(() => {});
  const trace = await page.evaluate(
    () =>
      new Promise((done) => {
        const me = document.querySelector("[data-room-resident]");
        const pet = document.querySelector("[data-showcase]");
        const rows = [];
        const t0 = performance.now();
        const tick = () => {
          const m = /translate3d\((-?\d+)px, (-?\d+)px/.exec(pet.style.transform);
          rows.push({ me: me.dataset.walk, pet: pet.dataset.walk, x: Number(m?.[1]), y: Number(m?.[2]) });
          if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
          else done(rows);
        };
        requestAnimationFrame(tick);
      }),
  );
  await room.screenshot({ path: `${outDir}/06-pet-following.png` });
  // 주인이 걷는 동안 동물의 걷기/서기 바뀜 수 (예전 코드는 몇 프레임마다 바뀌어 수십 번)
  let flips = 0;
  let walkingFrames = 0;
  let maxJump = 0;
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].me.startsWith("walk")) {
      walkingFrames++;
      if (trace[i].pet.slice(0, 4) !== trace[i - 1].pet.slice(0, 4)) flips++;
    }
    maxJump = Math.max(maxJump, Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y));
  }
  check("주인이 걷는 동안 전시 동물도 걷는다 (걷기 그림)", trace.some((r) => r.me.startsWith("walk") && r.pet.startsWith("walk")), `${walkingFrames}프레임`);
  check("전시 동물 걷기↔서기가 끊기지 않음 (4초에 4번 이하)", walkingFrames > 0 && flips <= 4, `바뀜 ${flips}번 / 걷는 ${walkingFrames}프레임`);
  check("전시 동물이 한 프레임에 크게 튀지 않음 (12px 이하)", maxJump <= 12, `${maxJump.toFixed(1)}px`);
}

// 주인이 문으로 나가면 마을 (광장 그림이 뜸)
await room.locator("[data-house-door]").click();
await page.waitForURL(new RegExp(`/town\\?at=${H}`), { timeout: 15000 }).catch(() => {});
check("문 → 마을", await page.locator("canvas").waitFor({ timeout: 15000 }).then(() => true, () => false));
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/house-door-town.png` });

// 375px: 가로 스크롤 없음
{
  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  errors.push(...collectErrors(mp));
  await loginDev(mp, H);
  await mp.goto(`${BASE}/@${H}`);
  await mp.locator("[data-house-room]").waitFor();
  await mp.waitForTimeout(1200);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("375px 블로그 가로 스크롤 없음", overflow <= 0, String(overflow));
  const fit = await mp.locator("[data-house-room] [data-room-grid]").evaluate((el) => el.getBoundingClientRect().width / el.offsetWidth);
  const box = await mp.locator("[data-house-room]").boundingBox();
  const stageBox = await mp.locator("[data-house-room] [data-room-grid]").boundingBox();
  check("375px 10×10 방은 1/2로 줄여 칸 안에 (도트 2배)", fit === 0.5 && stageBox.x >= box.x && stageBox.x + stageBox.width <= box.x + box.width, `배율 ${fit}`);
  await mp.locator("[data-house-room]").screenshot({ path: `${outDir}/02-room-375.png` });
  // 휴대폰에서도 끌어 옮기기 (줄인 배율로 칸 계산)
  await mp.locator("[data-house-room]").getByRole("button", { name: "🛋 가구 놓기" }).click();
  await dragTo("chair", 7, 3, null, mp);
  check("375px 편집: 끌어 옮기기 (의자 6,2 → 7,3)", (await tileOf("chair", mp)) === "7,3", await tileOf("chair", mp));
  await mp.locator("[data-house-room]").screenshot({ path: `${outDir}/07-edit-375.png` });
  const overflowEdit = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("375px 편집 중에도 가로 스크롤 없음", overflowEdit <= 0, String(overflowEdit));
  await m.close();
}

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
