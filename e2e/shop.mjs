// SHOP 영역: 상점 탭(가구·배경·성장, 옷·모자·소품은 옷가게)·정렬·버튼 상태, 성장 아이템 여러 개 사기·수량, 꾸미기 아바타 장착·벗기, 옷 입은 캐릭터가 블로그·마을·헤더에 보임, 농장에서 성장 아이템 쓰기
// 사용: 개발 서버를 띄운 상태에서 node e2e/shop.mjs <스크린샷 폴더>
// 요구사항: SHOP-01 상점 탭, SHOP-02 레벨 제한, SHOP-03 코인 부족
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

// ── 상점 탭 (FR-003, 2026-10-16 종류별로 나눔): 가구 → 배경 → 성장, 옷·모자·소품은 옷가게에서만 ──
await page.goto(`${BASE}/shop`);
const tabs = await page.locator("[data-shop-tab-button]").evaluateAll((els) => els.map((e) => e.getAttribute("data-shop-tab-button")));
check("상점 탭 3개 순서", tabs.join(",") === "furniture,background,growth", tabs.join(","));
const tab = async (key) => {
  await page.locator(`[data-shop-tab-button="${key}"]`).click();
  await page.locator(`[data-shop-tab="${key}"]`).waitFor();
};
check("처음은 가구 탭, 한 탭만 보인다", (await page.locator("[data-shop-tab]").count()) === 1 && (await page.locator("[data-shop-tab]").getAttribute("data-shop-tab")) === "furniture");
check("옷·모자·소품은 옷가게 안내", (await page.locator("[data-clothes-note]").innerText()).includes("옷·모자·소품") && (await page.locator("[data-clothes-note]").getByRole("link", { name: /옷가게 가기/ }).getAttribute("href")) === "/clothes");
const main = await page.locator("main").innerText();
// 제목 앞 🏪는 도트 가게 그림이 되었다 (2026-10-12 도트 화면)
check("상점 제목·안내", (await page.getByRole("heading", { level: 1 }).innerText()).trim() === "마을 상점" && main.includes("내 캐릭터와 우리 집을 꾸며 보세요"));
// 카드 제목으로 확인 (아이템 이름에 "고양이 귀 머리띠"처럼 같은 낱말이 들어갈 수 있다)
const titles = [];
for (const key of tabs) {
  await tab(key);
  titles.push(...(await page.locator("article h3").allInnerTexts()));
}
check("상점에 캐릭터·기본 아이템 없음", !["고양이", "나무 의자", "남자 주민"].some((n) => titles.includes(n)));
check("상점에 옷·모자·소품 없음 (옷가게에서만)", !["밀짚모자", "멜빵바지", "황금 예복", "목도리"].some((n) => titles.includes(n)));
check("새 배경 5종이 배경 탭에", ["가을 단풍", "숲속 버섯 마을", "노을 바다", "사막 오아시스", "과자 나라"].every((n) => titles.includes(n)));
await page.screenshot({ path: `${outDir}/shop-backgrounds.png`, fullPage: true });
await page.goto(`${BASE}/shop#growth`);
await page.locator('[data-shop-tab="growth"]').waitFor();
check("주소 #growth로 성장 아이템 탭", (await page.locator('[data-shop-tab-button="growth"]').getAttribute("aria-selected")) === "true");
await page.goto(`${BASE}/shop#hat`);
check("예전 주소 #hat은 옷가게로", await page.waitForURL(/\/clothes$/, { timeout: 10000 }).then(() => true, () => false), page.url());

// ── 버튼 상태 (FR-006): 가입 110코인, Lv.1 ──
await page.goto(`${BASE}/shop#background`);
await page.locator('[data-shop-tab="background"]').waitFor();
const btn = async (name) => (await card(name).getByRole("button").last().innerText()).trim();
check("Lv.2 눈 마을은 🔒 Lv.2", (await btn("눈 마을")) === "Lv.2", await btn("눈 마을"));
check("Lv.2+ 표시", (await card("눈 마을").innerText()).includes("Lv.2+"));
check("코인 모자라면 코인 부족 (바닷가 120 > 110)", (await btn("바닷가")) === "코인 부족", await btn("바닷가"));
await tab("furniture");
check("Lv.1은 Lv 표시 없음", !(await card("둥근 탁자").innerText()).includes("Lv.1+"));

// ── 사기: 둥근 탁자 40 → 보유 중, 코인 차감, 원장 ──
const before = await coins(page);
await card("둥근 탁자").getByRole("button", { name: "사기" }).click();
await page.getByRole("status").filter({ hasText: "샀어요" }).waitFor({ timeout: 10000 });
check("산 안내: 우리 집", (await page.getByRole("status").innerText()).includes("우리 집"));
await page.waitForLoadState("networkidle");
// 산 뒤 화면 새로 그리기(revalidatePath)가 안내보다 늦게 올 수 있어 버튼이 바뀔 때까지 기다린다
await card("둥근 탁자").getByRole("button", { name: "보유 중" }).waitFor({ timeout: 10000 }).catch(() => {});
check("둥근 탁자 보유 중", (await btn("둥근 탁자")) === "보유 중");
check("코인 −40", (await coins(page)) === before - 40, `${before} → ${await coins(page)}`);
const ledger = await one("SELECT coin_delta FROM point_ledger WHERE user_id = $1 AND reason = 'purchase' ORDER BY id DESC LIMIT 1", [uid]);
check("원장 purchase −40", ledger?.coin_delta === -40);

// ── 성장 아이템 여러 개 한 번에 (2026-10-16): [+] 두 번 → 3개 사기 · 60, 원장 한 줄 −60, 수량 3 ──
await tab("growth");
const feed = card("동물 먹이");
await feed.getByRole("button", { name: "개수 하나 늘리기" }).click();
await feed.getByRole("button", { name: "개수 하나 늘리기" }).click();
check("개수 칸 3", (await feed.getByRole("spinbutton").inputValue()) === "3");
check("버튼에 3개 · 합계 60", (await btn("동물 먹이")).replace(/\s+/g, " ").includes("3개 사기") && (await btn("동물 먹이")).includes("60"), await btn("동물 먹이"));
check("[최대]는 지금 코인만큼 (70 ÷ 20 = 3개)", (await feed.getByRole("button", { name: /최대/ }).innerText()).includes("3개"));
await feed.getByRole("button", { name: /3개 사기/ }).click();
await page.getByRole("status").filter({ hasText: "동물 먹이 3개를 샀어요" }).waitFor({ timeout: 10000 });
await page.waitForLoadState("networkidle");
const qty = await one("SELECT quantity FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = 'growth_feed'", [uid]);
check("성장 아이템 3개 → 수량 3", qty?.quantity === 3, String(qty?.quantity));
const bulk = await one("SELECT coin_delta FROM point_ledger WHERE user_id = $1 AND reason = 'purchase' ORDER BY id DESC LIMIT 1", [uid]);
check("원장 한 줄 −60", bulk?.coin_delta === -60, String(bulk?.coin_delta));
await feed.getByText("보유 3개").waitFor({ timeout: 10000 }).catch(() => {});
check("카드에 보유 3개, 남은 10코인이라 코인 부족", (await feed.innerText()).includes("보유 3개") && (await btn("동물 먹이")) === "코인 부족", await btn("동물 먹이"));
await page.screenshot({ path: `${outDir}/shop-bulk.png`, fullPage: true });

// ── 서버가 막는다: 판매 안 하는 것 ──
const owned = await db.query("SELECT 1 FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = 'char_cat'", [uid]);
check("판매 안 하는 캐릭터는 상점에 없음", owned.rowCount === 0 && (await card("고양이").count()) === 0);

// ── 정렬 (FR-014): 비싼 순 → 배경 탭 첫 카드는 과자 나라(1,200) ──
await tab("background");
await page.getByLabel("정렬").selectOption("priceDesc");
const firstBg = await page.locator('[data-shop-tab="background"] article h3').first().innerText();
check("비싼 순: 과자 나라(1,200)가 먼저", firstBg === "과자 나라", firstBg);
await tab("furniture");
await page.getByLabel("정렬").selectOption("priceAsc");
check("싼 순: 가구 탭은 나무 스툴이 먼저 (정렬은 탭을 바꿔도 그대로)", (await page.locator('[data-shop-tab="furniture"] article h3').first().innerText()) === "나무 스툴");
await page.screenshot({ path: `${outDir}/shop.png`, fullPage: true });

// 꾸미기 장착 시험용 밀짚모자 (옷가게 구매는 style.mjs가 본다)
await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code = 'hat_straw'", [uid]);

// ── 꾸미기: 아바타 장착 → 저장 표시 → 미니룸·헤더에 반영, 다시 누르면 벗기 ──
await page.goto(`${BASE}/closet`);
check("꾸미기 구역: 아바타·배경·가구, 캐릭터 1마리면 🐾 없음",
  (await page.locator("[data-closet-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-closet-section")).join(","))) === "avatar,background,furniture");
check("꾸미기 하단 안내", (await page.locator("main").innerText()).includes("더 많은 꾸미기 아이템과 배경은"));
const straw = page.getByRole("button", { name: /밀짚모자/ });
const saveBtn = page.locator("[data-closet-save]");
check("처음엔 바꾼 게 없어 [저장]이 꺼져 있다", await saveBtn.isDisabled());
await straw.click();
// 눌러 보기만 하면 미리보기, [저장]을 눌러야 적용 (2026-10-16 "저장 누르면 적용")
await page.waitForTimeout(500);
check("눌러 보기만 하면 저장 안 됨 (미리보기)", (await straw.getAttribute("aria-pressed")) === "true" && (await db.query("SELECT 1 FROM avatar_equips WHERE user_id = $1", [uid])).rowCount === 0 && (await page.locator("[data-closet-savebar]").getAttribute("data-dirty")) === "true");
await saveBtn.click();
check("[저장] → 저장 표시", await page.getByRole("status").filter({ hasText: "꾸민 모습을 저장했어요 ✓" }).waitFor({ timeout: 5000 }).then(() => true, () => false));
check("장착 버튼 눌림", (await straw.getAttribute("aria-pressed")) === "true");
const worn = await one("SELECT i.code FROM avatar_equips ae JOIN items i ON i.id = ae.item_id WHERE ae.user_id = $1", [uid]);
check("DB avatar_equips 모자", worn?.code === "hat_straw");
await page.screenshot({ path: `${outDir}/closet.png`, fullPage: true });
await page.reload();
const headerLook = await page.getByRole("banner").locator("[data-look]").first().getAttribute("data-look");
check("헤더 캐릭터가 모자를 씀", headerLook?.includes("hat.straw"), headerLook);

// 블로그 우리 집 방 안 캐릭터, 마을 캐릭터
await page.goto(`${BASE}/@${N}`);
const blogLook = await page.locator("[data-house-room] [data-room-resident]").getAttribute("data-look");
check("블로그 우리 집 캐릭터가 모자를 씀", blogLook?.includes("hat.straw"), blogLook);
await page.goto(`${BASE}/town`);
await page.locator("canvas").waitFor({ timeout: 15000 });
const townLook = await page.locator("[data-player-look]").getAttribute("data-player-look");
check("마을 캐릭터가 모자를 씀", townLook?.includes("hat.straw"), townLook);

// 벗기
await page.goto(`${BASE}/closet`);
await page.getByRole("button", { name: /밀짚모자/ }).click();
await page.locator("[data-closet-save]").click();
await page.getByRole("status").filter({ hasText: "저장했어요" }).waitFor({ timeout: 5000 });
check("다시 누르면 벗기", (await db.query("SELECT 1 FROM avatar_equips WHERE user_id = $1", [uid])).rowCount === 0);

// 같은 부위는 하나만: 리본을 사서 끼면 밀짚모자 자리를 바꾼다
await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code IN ('hat_ribbon', 'acc_glasses')", [uid]);
await page.reload();
await page.getByRole("button", { name: /밀짚모자/ }).click();
await page.locator("[data-closet-save]").click();
await page.getByRole("status").filter({ hasText: "저장했어요" }).waitFor();
// 리본·안경을 함께 골라 한 번에 저장
await page.getByRole("button", { name: /리본/ }).click();
await page.getByRole("button", { name: /안경/ }).click();
check("저장 줄: 2가지 바꿈", (await page.locator("[data-closet-savebar]").innerText()).includes("2가지 바꿨어요"));
await page.locator("[data-closet-save]").click();
await page.locator('[data-closet-savebar][data-dirty="false"]').waitFor();
const slots = (await db.query("SELECT ae.slot, i.code FROM avatar_equips ae JOIN items i ON i.id = ae.item_id WHERE ae.user_id = $1 ORDER BY slot", [uid])).rows.map((r) => `${r.slot}:${r.code}`).join(",");
check("부위마다 하나 (모자는 리본으로 바뀜)", slots === "hat:hat_ribbon,accessory:acc_glasses", slots);

// DB가 갖지 않은 아이템 장착을 막는다
const blocked = await db
  .query("INSERT INTO avatar_equips (user_id, slot, item_id) SELECT $1, 'outfit', id FROM items WHERE code = 'outfit_dress'", [uid])
  .then(() => false, () => true);
check("DB: 갖지 않은 옷은 못 입음", blocked);

// ── 농장: 성장 아이템 먹이기 → 성장 +20, 수량 −1 ──
const sp = await one("SELECT id, grow_exp FROM animal_species ORDER BY grow_exp DESC LIMIT 1");
const animal = await one("INSERT INTO user_animals (user_id, sex, source, status, species_id, growth) VALUES ($1, 'female', 'shop', 'growing', $2, 0) RETURNING id", [uid, sp.id]);
await page.goto(`${BASE}/farm`);
await page.getByRole("button", { name: /동물 먹이 ×3/ }).first().click();
await page.getByRole("status").filter({ hasText: "먹였어요" }).waitFor({ timeout: 10000 }).catch(() => {});
await page.waitForLoadState("networkidle");
const grown = await one("SELECT growth FROM user_animals WHERE id = $1", [animal.id]);
const left = await one("SELECT quantity FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = 'growth_feed'", [uid]);
check("농장: 동물 먹이 → 성장 +20", grown.growth === 20, String(grown.growth));
check("농장: 수량 3 → 2", left.quantity === 2, String(left.quantity));
check("농장 버튼 ×2로 바뀜", await page.getByRole("button", { name: /동물 먹이 ×2/ }).first().isVisible());
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
