// 마을 개편 2차 (사용자 요청 2026-10-08): 블로그의 "우리 집" 구역(가구 놓기, 🚪 문), 집 단계별 칸 수, 상점 가구
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
const browser = await chromium.launch();
const H = `hs${Date.now() % 100_000_000}`;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, H);
const uid = (await one("SELECT id FROM users WHERE username = $1", [H])).id;
const placed = async () => (await db.query("SELECT h.slot, i.code FROM house_furniture h JOIN items i ON i.id = h.item_id WHERE h.user_id = $1 ORDER BY slot", [uid])).rows.map((r) => `${r.slot}:${r.code}`).join(",");

// 가입하면 기본 가구 2개 (화분·나무 의자)
const starters = (await db.query("SELECT i.code FROM user_items u JOIN items i ON i.id = u.item_id WHERE u.user_id = $1 AND i.type = 'furniture' ORDER BY i.code", [uid])).rows.map((r) => r.code);
check("가입하면 기본 가구 화분·나무 의자", starters.join(",") === "fur_chair,fur_plant", starters.join(","));

// 우리 집: 1단계 4칸
await page.goto(`${BASE}/@${H}`);
const room = page.locator("[data-house-room]");
const head = await room.innerText();
check("우리 집: 1단계 작은 오두막, 기본 가구 2/4칸, Lv.10에 커짐", head.includes("1단계 작은 오두막") && head.includes("가구 2/4칸") && head.includes("Lv.10에 집이 커져요"), head.split("\n").slice(0, 3).join(" "));
check("가입하면 기본 가구가 0·1번 칸에 놓여 있음 (빈 방 아님)", (await placed()) === "0:fur_plant,1:fur_chair", await placed());

// 지붕 색 (TOWN-07): 1단계는 처음 받은 무작위 색 1개만 열려 있고 9개는 잠김
const roofButton = room.getByRole("button", { name: "🏠 지붕 색" });
const roofPicker = room.locator("[data-roof-picker]");
await roofButton.click();
const openRoofs = async () => roofPicker.locator("[data-roof]").evaluateAll((els) => els.map((e) => e.getAttribute("data-roof")));
const firstRoofs = await openRoofs();
check("1단계 지붕 색: 1개 열림, 9개 잠김", firstRoofs.length === 1 && (await roofPicker.getByText("🔒").count()) === 9, firstRoofs.join(","));
check("안 고른 지붕은 처음 색이 선택됨", (await roofPicker.locator('[data-roof][aria-pressed="true"]').count()) === 1);
await page.screenshot({ path: `${outDir}/house-roof-1.png` });
await roofButton.click();

// 가구 놓기: 기본 가구(0번 칸 화분, 1번 칸 의자)를 옮기고 비워 본다
const pick = async (slot, name) => {
  await room.locator(`[data-slot="${slot}"]`).click();
  await room.getByRole("dialog").getByRole("button", { name }).click();
  await room.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 });
  await page.waitForLoadState("networkidle");
};
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
check("주인 편집: 칸 4개", (await room.locator("[data-slot]").count()) === 4);
// 같은 가구를 다른 칸에 놓으면 옮겨진다 (가구 하나는 한 칸에만)
await pick(2, /나무 의자/);
check("칸에 가구 저장 (의자 2번 → 3번 칸)", (await placed()) === "0:fur_plant,2:fur_chair", await placed());
await pick(3, /초록 화분/);
check("같은 가구는 옮겨짐 (한 칸에만)", (await placed()) === "2:fur_chair,3:fur_plant", await placed());
// 비우기
await room.locator('[data-slot="2"]').click();
await room.getByRole("dialog").getByRole("button", { name: /비우기/ }).click();
await room.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 });
await page.waitForLoadState("networkidle");
check("비우기", (await placed()) === "3:fur_plant", await placed());
await pick(0, /나무 의자/);
await room.getByRole("button", { name: /다 놓았어요/ }).click();
await page.screenshot({ path: `${outDir}/house-owner.png` });

// DB가 남의 가구·없는 칸을 막는다
const blocked = async (q, p) => db.query(q, p).then(() => false, () => true);
check(
  "DB: 갖지 않은 가구는 못 놓음",
  await blocked("INSERT INTO house_furniture (user_id, slot, item_id) SELECT $1, 5, id FROM items WHERE code = 'fur_sofa'", [uid]),
);
check("DB: 8번 칸(0~7 밖)은 못 놓음", await blocked("INSERT INTO house_furniture (user_id, slot, item_id) SELECT $1, 8, id FROM items WHERE code = 'fur_chair'", [uid]));

// 상점 가구: 둥근 탁자 사기 → 가구 놓기 목록에 생김
await page.goto(`${BASE}/shop`);
const table = page.locator("article", { hasText: "둥근 탁자" });
check("상점에 🛋 가구", await page.getByRole("heading", { name: /가구/ }).isVisible());
await table.getByRole("button", { name: "사기" }).click();
await page.getByRole("status").waitFor();
check("가구 산 안내", (await page.getByRole("status").innerText()).includes("우리 집"));

// 레벨 10 → 2단계 6칸: 6번 칸에 탁자 (레벨 n까지 10 × n × (n − 1), src/lib/game.ts)
const expFor = (lv) => 10 * lv * (lv - 1);
const setExp = async (target) => {
  const { exp } = await one("SELECT COALESCE(SUM(exp_delta), 0)::int AS exp FROM point_ledger WHERE user_id = $1", [uid]);
  if (target > exp) await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', $2, 0)", [uid, target - exp]);
};
await setExp(expFor(10));
await page.goto(`${BASE}/@${H}`);
check("Lv.10 → 2단계 창문 많은 집, 6칸", (await room.innerText()).includes("2단계 창문 많은 집") && (await room.innerText()).includes("/6칸"));
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
await room.getByRole("button", { name: "🛋 가구 놓기" }).click();
await pick(5, /둥근 탁자/);
check("2단계: 6번 칸에 놓기", (await placed()).includes("5:fur_table"), await placed());
await room.getByRole("button", { name: /다 놓았어요/ }).click();

// 방문자: 가구가 보이고, 가구 놓기 버튼은 없음. 문 → 마을의 이 집 앞
{
  const g = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const gp = await g.newPage();
  errors.push(...collectErrors(gp));
  await gp.goto(`${BASE}/@${H}`);
  const groom = gp.locator("[data-house-room]");
  const shown = await groom.locator("[data-furniture]").evaluateAll((els) => els.map((e) => e.getAttribute("data-furniture")).join(","));
  check("방문자에게 가구 3개 보임", shown === "furniture.chair,furniture.plant,furniture.table", shown);
  check("방문자에게 가구 놓기 없음", (await groom.getByRole("button", { name: /가구 놓기/ }).count()) === 0);
  check("문 주소 = /town?at=주소", (await groom.locator("[data-house-door]").getAttribute("href")) === `/town?at=${H}`);
  await gp.screenshot({ path: `${outDir}/house-visitor.png` });
  await g.close();
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
  await mp.goto(`${BASE}/@${H}`);
  await mp.locator("[data-house-room]").waitFor();
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("375px 블로그 가로 스크롤 없음", overflow <= 0, String(overflow));
  await mp.locator("[data-house-room]").screenshot({ path: `${outDir}/house-375.png` });
  await m.close();
}

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
