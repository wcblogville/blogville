// SHOP 영역: 상점 구역·정렬·버튼 상태, 성장 아이템 수량, 꾸미기 아바타 장착·벗기, 옷 입은 캐릭터가 블로그·마을·헤더에 보임, 농장에서 성장 아이템 쓰기
// 사용: 개발 서버를 띄운 상태에서 node e2e/shop.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const N = `sh${Date.now() % 100_000_000}`;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, N);
const uid = (await one("SELECT id FROM users WHERE username = $1", [N])).id;
const card = (name) => page.locator("article", { has: page.getByRole("heading", { name, exact: true }) });

// ── 상점 구역 (FR-003): 아바타 → 가구 → 배경 → 성장, 캐릭터 없음 ──
await page.goto(`${BASE}/shop`);
const sections = await page.locator("[data-shop-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-shop-section")));
check("상점 구역 5개 순서 (광장 장식은 가구 다음)", sections.join(",") === "avatar,furniture,deco,background,growth", sections.join(","));
const main = await page.locator("main").innerText();
check("상점 제목·안내", main.includes("🏪 마을 상점") && main.includes("내 캐릭터와 미니룸을 꾸며 보세요"));
check("상점에 캐릭터·기본 아이템 없음", !main.includes("고양이") && !main.includes("나무 의자") && !main.includes("남자 주민"));

// ── 버튼 상태 (FR-006): 가입 110코인, Lv.1 ──
const btn = async (name) => (await card(name).getByRole("button").innerText()).trim();
check("Lv.2 털모자는 🔒 Lv.2", (await btn("털모자")) === "🔒 Lv.2", await btn("털모자"));
check("Lv.2+ 표시", (await card("털모자").innerText()).includes("Lv.2+"));
check("Lv.1은 Lv 표시 없음", !(await card("밀짚모자").innerText()).includes("Lv.1+"));
check("코인 모자라면 코인 부족 (멜빵바지 100은 사기)", (await btn("멜빵바지")) === "사기" && (await btn("목도리")).startsWith("🔒"));

// ── 사기: 밀짚모자 50 → 보유 중, 코인 차감, 원장 ──
const before = await coins(page);
await card("밀짚모자").getByRole("button", { name: "사기" }).click();
await page.getByRole("status").filter({ hasText: "샀어요" }).waitFor({ timeout: 10000 });
check("산 안내: 꾸미기에서 장착", (await page.getByRole("status").innerText()).includes("꾸미기"));
await page.waitForLoadState("networkidle");
check("밀짚모자 보유 중", (await btn("밀짚모자")) === "보유 중");
check("코인 −50", (await coins(page)) === before - 50, `${before} → ${await coins(page)}`);
const ledger = await one("SELECT coin_delta FROM point_ledger WHERE user_id = $1 AND reason = 'purchase' ORDER BY id DESC LIMIT 1", [uid]);
check("원장 purchase −50", ledger?.coin_delta === -50);

// ── 성장 아이템: 두 번 사면 수량 2, 버튼은 계속 사기 ──
for (let i = 0; i < 2; i++) {
  await card("동물 먹이").getByRole("button", { name: "사기" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}
const qty = await one("SELECT quantity FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = 'growth_feed'", [uid]);
check("성장 아이템 두 번 → 수량 2", qty?.quantity === 2, String(qty?.quantity));
check("성장 아이템 카드에 보유 2개, 버튼은 사기", (await card("동물 먹이").innerText()).includes("보유 2개") && (await btn("동물 먹이")) === "사기");

// ── 서버가 막는다: 이미 가진 것, 판매 안 하는 것, 잠긴 것 ──
// (화면 버튼이 꺼져 있어도 요청을 직접 보낼 수 있으니 DB 규칙으로도 확인)
const owned = await db.query("SELECT 1 FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = 'char_cat'", [uid]);
check("판매 안 하는 캐릭터는 상점에 없음", owned.rowCount === 0 && (await page.locator("article", { hasText: "고양이" }).count()) === 0);

// ── 정렬 (FR-014): 비싼 순 → 아바타 구역 첫 카드는 원피스(200) ──
await page.getByLabel("정렬").selectOption("priceDesc");
const firstAvatar = await page.locator('[data-shop-section="avatar"] article h3').first().innerText();
check("비싼 순: 원피스가 먼저", firstAvatar === "원피스", firstAvatar);
await page.getByLabel("정렬").selectOption("priceAsc");
check("싼 순: 밀짚모자가 먼저", (await page.locator('[data-shop-section="avatar"] article h3').first().innerText()) === "밀짚모자");
await page.screenshot({ path: `${outDir}/shop.png`, fullPage: true });

// ── 꾸미기: 아바타 장착 → 저장 표시 → 미니룸·헤더에 반영, 다시 누르면 벗기 ──
await page.goto(`${BASE}/closet`);
check("꾸미기 구역: 아바타·배경·가구, 캐릭터 1마리면 🐾 없음",
  (await page.locator("[data-closet-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-closet-section")).join(","))) === "avatar,background,furniture");
check("꾸미기 하단 안내", (await page.locator("main").innerText()).includes("더 많은 꾸미기 아이템과 배경은"));
const straw = page.getByRole("button", { name: /밀짚모자/ });
await straw.click();
check("장착 저장 표시", await page.getByRole("status").filter({ hasText: "밀짚모자 장착을 저장했어요 ✓" }).waitFor({ timeout: 5000 }).then(() => true, () => false));
check("장착 버튼 눌림", (await straw.getAttribute("aria-pressed")) === "true");
const worn = await one("SELECT i.code FROM avatar_equips ae JOIN items i ON i.id = ae.item_id WHERE ae.user_id = $1", [uid]);
check("DB avatar_equips 모자", worn?.code === "hat_straw");
await page.screenshot({ path: `${outDir}/closet.png`, fullPage: true });
await page.reload();
const headerLook = await page.getByRole("banner").locator("[data-look]").first().getAttribute("data-look");
check("헤더 캐릭터가 모자를 씀", headerLook?.includes("hat.straw"), headerLook);

// 블로그 미니룸, 마을 캐릭터
await page.goto(`${BASE}/@${N}`);
const blogLook = await page.locator("section").first().locator("[data-look]").first().getAttribute("data-look");
check("블로그 미니룸 캐릭터가 모자를 씀", blogLook?.includes("hat.straw"), blogLook);
await page.goto(`${BASE}/town`);
await page.locator("canvas").waitFor({ timeout: 15000 });
const townLook = await page.locator("[data-player-look]").getAttribute("data-player-look");
check("마을 캐릭터가 모자를 씀", townLook?.includes("hat.straw"), townLook);

// 벗기
await page.goto(`${BASE}/closet`);
await page.getByRole("button", { name: /밀짚모자/ }).click();
await page.getByRole("status").filter({ hasText: "벗었어요" }).waitFor({ timeout: 5000 });
check("다시 누르면 벗기", (await db.query("SELECT 1 FROM avatar_equips WHERE user_id = $1", [uid])).rowCount === 0);

// 같은 부위는 하나만: 리본을 사서 끼면 밀짚모자 자리를 바꾼다
await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code IN ('hat_ribbon', 'acc_glasses')", [uid]);
await page.reload();
await page.getByRole("button", { name: /밀짚모자/ }).click();
await page.getByRole("status").filter({ hasText: "저장했어요" }).waitFor();
await page.getByRole("button", { name: /리본/ }).click();
await page.getByRole("status").filter({ hasText: "리본 장착" }).waitFor();
await page.getByRole("button", { name: /안경/ }).click();
await page.getByRole("status").filter({ hasText: "안경 장착" }).waitFor();
const slots = (await db.query("SELECT ae.slot, i.code FROM avatar_equips ae JOIN items i ON i.id = ae.item_id WHERE ae.user_id = $1 ORDER BY slot", [uid])).rows.map((r) => `${r.slot}:${r.code}`).join(",");
check("부위마다 하나 (모자는 리본으로 바뀜)", slots === "hat:hat_ribbon,accessory:acc_glasses", slots);

// DB가 갖지 않은 아이템 장착을 막는다
const blocked = await db
  .query("INSERT INTO avatar_equips (user_id, slot, item_id) SELECT $1, 'outfit', id FROM items WHERE code = 'outfit_dress'", [uid])
  .then(() => false, () => true);
check("DB: 갖지 않은 옷은 못 입음", blocked);

// ── 농장: 성장 아이템 먹이기 → 성장 +20, 수량 −1 ──
const sp = await one("SELECT id, grow_exp FROM animal_species ORDER BY grow_exp DESC LIMIT 1");
const animal = await one("INSERT INTO user_animals (user_id, source, status, species_id, growth) VALUES ($1, 'shop', 'growing', $2, 0) RETURNING id", [uid, sp.id]);
await page.goto(`${BASE}/farm`);
await page.getByRole("button", { name: /동물 먹이 ×2/ }).first().click();
await page.getByRole("status").filter({ hasText: "먹였어요" }).waitFor({ timeout: 10000 }).catch(() => {});
await page.waitForLoadState("networkidle");
const grown = await one("SELECT growth FROM user_animals WHERE id = $1", [animal.id]);
const left = await one("SELECT quantity FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = 'growth_feed'", [uid]);
check("농장: 동물 먹이 → 성장 +20", grown.growth === 20, String(grown.growth));
check("농장: 수량 2 → 1", left.quantity === 1, String(left.quantity));
check("농장 버튼 ×1로 바뀜", await page.getByRole("button", { name: /동물 먹이 ×1/ }).first().isVisible());
await page.screenshot({ path: `${outDir}/shop-farm.png`, fullPage: true });

// ── 375px: 상점·꾸미기 가로 스크롤 없음 ──
{
  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  errors.push(...collectErrors(mp));
  for (const path of ["/shop", "/closet"]) {
    await mp.goto(`${BASE}${path}`);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`375px ${path} 가로 스크롤 없음`, overflow <= 0, String(overflow));
  }
  await mp.screenshot({ path: `${outDir}/closet-375.png`, fullPage: true });
  await m.close();
}

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
