// 성장 촉진제 (SHOP-01·TOWN-09, 사용자 요청 2026-10-11 "성장 촉진제 사용할 수 있게"): 상점에서 사고 → 농장 🎒 성장 아이템에 모이고 →
// 동물 카드의 🌱 버튼으로 써서 자란다. 다 자라게 하는 아이템은 버튼에 "🎉 다 자라요"가 보이고, 쓰면 다 키운 보상을 받는다
// 사용: 개발 서버를 띄운 상태에서 node e2e/booster.mjs <스크린샷 폴더>
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
const N = `bo${Date.now() % 100_000_000}`;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, N);
const uid = (await one("SELECT id FROM users WHERE username = $1", [N])).id;
// 시험용 코인·경험치 (관리자 테스트 지급과 같은 원장 사유): Lv.6 (경험치 300), 코인 넉넉히
await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'admin_grant', 300, 2000)", [uid]);
const qty = async (code) => (await one("SELECT COALESCE(SUM(ui.quantity), 0)::int AS q FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = $2", [uid, code])).q;
const wallet = async () => (await one("SELECT COALESCE(SUM(coin_delta), 0)::int AS c FROM point_ledger WHERE user_id = $1", [uid])).c;
const card = (name) => page.locator("article", { has: page.getByRole("heading", { name, exact: true }) });

// ── 1. 성장 아이템이 없으면 농장 가방이 상점으로 안내 ──
await page.goto(`${BASE}/farm`);
const bag = page.locator("[data-growth-bag]");
check("농장에 🎒 성장 아이템 가방", await bag.isVisible());
check("가진 것이 없으면 안내 + 상점 링크", (await bag.innerText()).includes("가진 성장 아이템이 없어요") && (await bag.getByRole("link", { name: /상점에서 더 사기/ }).getAttribute("href")) === "/shop#growth");

// ── 2. 상점에서 성장 촉진제·황금 성장 물약 사기 ──
await page.goto(`${BASE}/shop#growth`);
const before = await wallet();
await card("성장 촉진제").getByRole("button", { name: "사기" }).click();
await page.getByRole("status").filter({ hasText: "샀어요" }).waitFor({ timeout: 10000 });
check("산 안내: 동물 농장으로", (await page.getByRole("status").innerText()).includes("동물 농장") && (await page.getByRole("link", { name: /동물 농장으로/ }).isVisible()));
await page.waitForLoadState("networkidle");
await card("황금 성장 물약").getByRole("button", { name: "사기" }).click();
await page.getByRole("status").filter({ hasText: "황금 성장 물약" }).waitFor({ timeout: 10000 });
await page.waitForLoadState("networkidle");
check("수량: 촉진제 1, 물약 1", (await qty("growth_booster")) === 1 && (await qty("growth_elixir")) === 1);
check("원장 코인 −150 −400", (await wallet()) === before - 550, `${before} → ${await wallet()}`);
check("헤더 코인도 줄어듦", await page.waitForFunction((n) => Number(document.querySelector('header [title="코인"]')?.getAttribute("data-coins")) === n, before - 550, { timeout: 10000 }).then(() => true, () => false));
const boosterCard = await card("성장 촉진제").innerText();
check("카드에 보유 1개 · 농장에서 쓰기", boosterCard.includes("보유 1개") && (await card("성장 촉진제").getByRole("link", { name: "농장에서 쓰기" }).getAttribute("href")) === "/farm");
await page.locator('[data-shop-section="growth"]').screenshot({ path: `${outDir}/booster-shop.png` });

// ── 3. 농장: 가방에 보이고, 키우는 동물에게 쓴다 ──
const sp = await one("SELECT id, name, grow_exp, reward_coins FROM animal_species ORDER BY grow_exp DESC LIMIT 1");
const animal = await one("INSERT INTO user_animals (user_id, source, status, species_id, growth, hatched_at) VALUES ($1, 'shop', 'growing', $2, 0, now()) RETURNING id", [uid, sp.id]);
await page.goto(`${BASE}/farm`);
const bagText = await bag.innerText();
check("가방에 촉진제 ×1 · 한 번에 성장 +100", bagText.includes("성장 촉진제 ×1") && bagText.includes("한 번에 성장 +100"));
check("가방에 황금 성장 물약 +300", bagText.includes("황금 성장 물약 ×1") && bagText.includes("한 번에 성장 +300"));
check("가방 그림", (await bag.locator('[data-growth-bag-item="growth.booster"] img').count()) === 1);
const useBooster = page.locator('[data-use-growth="growth.booster"]').first();
check("동물 카드에 촉진제 버튼 (+100)", (await useBooster.innerText()).includes("+100"));
check("물약 버튼은 다 자란다고 미리 알림", (await page.locator('[data-use-growth="growth.elixir"]').first().innerText()).includes("다 자라요"));
await page.screenshot({ path: `${outDir}/booster-farm.png`, fullPage: true });

await useBooster.click();
await page.getByRole("status").filter({ hasText: "성장 촉진제 먹였어요" }).waitFor({ timeout: 10000 });
check("결과: 성장 +100", (await page.getByRole("status").innerText()).includes("성장 +100"));
await page.waitForLoadState("networkidle");
check("DB: 성장 100, 촉진제 0개", (await one("SELECT growth FROM user_animals WHERE id = $1", [animal.id])).growth === 100 && (await qty("growth_booster")) === 0);
check("다 쓰면 촉진제 버튼이 사라짐", (await page.locator('[data-use-growth="growth.booster"]').count()) === 0);

// ── 4. 황금 성장 물약으로 다 키우기 → 보상 ──
const coinsBefore = await wallet();
await page.locator('[data-use-growth="growth.elixir"]').first().click();
await page.getByRole("status").filter({ hasText: "다 자랐어요" }).waitFor({ timeout: 10000 });
await page.waitForLoadState("networkidle");
const done = await one("SELECT status, growth FROM user_animals WHERE id = $1", [animal.id]);
check("다 자람 (성장은 최대에서 멈춤)", done.status === "grown" && done.growth === sp.grow_exp, `${done.status} ${done.growth}`);
check("다 키운 보상 코인", (await wallet()) === coinsBefore + sp.reward_coins, `${coinsBefore} → ${await wallet()}`);
check("원장 farm_grown", (await one("SELECT COUNT(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'farm_grown'", [uid])).n === 1);
check("가방이 다시 비어 안내", await bag.getByText("가진 성장 아이템이 없어요").waitFor({ timeout: 10000 }).then(() => true, () => false));
await page.screenshot({ path: `${outDir}/booster-grown.png`, fullPage: true });

// ── 5. 375px: 농장 가로 스크롤 없음 ──
{
  await db.query("UPDATE user_items SET quantity = 3 FROM items WHERE items.id = user_items.item_id AND user_items.user_id = $1 AND items.code = 'growth_booster'", [uid]);
  await db.query("INSERT INTO user_animals (user_id, source, status, species_id, growth, hatched_at) VALUES ($1, 'shop', 'growing', $2, 10, now())", [uid, sp.id]);
  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  errors.push(...collectErrors(mp));
  await mp.goto(`${BASE}/farm`);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("375px /farm 가로 스크롤 없음", overflow <= 0, String(overflow));
  await mp.screenshot({ path: `${outDir}/booster-375.png`, fullPage: true });
  await m.close();
}

check("화면 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
