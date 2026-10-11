// 친구 마을 구경 (사용자 요청 2026-10-09, 집 자리는 그 회원이 고른 대로 TOWN-18)과 광장 꾸미기를 쉬는지 (사용자 결정 2026-10-11, TOWN-16 ❌)
// 사용: 개발 서버를 띄운 상태에서 node e2e/plaza.mjs <스크린샷 폴더>
// 실행마다 새 회원 P(마을 주인)·Q(놀러 가는 친구)를 만든다. DB는 .env.local의 DATABASE_URL로 확인한다.
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, args) => (await db.query(q, args)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const n = Date.now() % 100_000_000;
const P = `pz${n}`;
const Q = `pq${n}`;
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };
/** 광장 왼쪽 위 [☰ 메뉴] (안 읽은 알림 수가 붙어도 찾게) */
const menuButton = (page) => page.locator('button[aria-haspopup="dialog"]');

async function member(id) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await loginDev(page, id);
  const uid = (await one("SELECT id FROM users WHERE username = $1", [id])).id;
  return { ctx, page, errors, uid };
}

const p = await member(P);
const q = await member(Q);
const placed = async () =>
  (
    await db.query("SELECT d.slot, i.code FROM town_decorations d JOIN items i ON i.id = d.item_id WHERE d.user_id = $1 ORDER BY d.slot", [p.uid])
  ).rows
    .map((r) => `${r.slot}:${r.code}`)
    .join(",");

// ── 광장 꾸미기는 쉬는 중 (사용자 결정 2026-10-11, TOWN-16 ❌): 표와 데이터는 남기고 화면에서만 뺐다 ──
{
  const page = p.page;
  await page.goto(`${BASE}/shop`);
  check("상점에 🌷 광장 장식 구역 없음", (await page.locator('[data-shop-section="deco"]').count()) === 0 && !(await page.locator("main").innerText()).includes("나무 벤치"));
  const onSale = (await one("SELECT count(*)::int AS n FROM items WHERE type = 'deco' AND is_on_sale")).n;
  const kept = (await one("SELECT count(*)::int AS n FROM items WHERE type = 'deco'")).n;
  check("장식 아이템은 남아 있고 팔지 않음 (DB)", kept === 8 && onSale === 0, `${kept}개 중 판매 ${onSale}`);

  // 예전에 놓아 둔 장식(데이터)은 지우지 않는다: P가 벤치를 가지고 1번 자리에 놓아 둔 상태를 만든다
  const bench = (await one("SELECT id FROM items WHERE code = 'deco_bench'")).id;
  await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2)", [p.uid, bench]);
  await db.query("INSERT INTO town_decorations (user_id, slot, item_id) VALUES ($1, 0, $2)", [p.uid, bench]);

  await page.goto(`${BASE}/town?deco=1`);
  await page.locator("canvas").waitFor({ timeout: 20000 });
  check("?deco=1이어도 꾸미기 창이 열리지 않음", (await page.locator('[data-town-panel="deco"]').count()) === 0);
  check("광장에 장식 목록을 그리지 않음 (data-decorations 없음)", (await page.locator("[data-decorations]").count()) === 0);
  await menuButton(page).click();
  const menu = page.locator('[data-town-panel="menu"]');
  check("☰ 메뉴에 🌷 광장 꾸미기 없음", !(await menu.innerText()).includes("광장 꾸미기"), await menu.innerText());
  await page.goto(`${BASE}/closet`);
  const closet = page.locator('[data-closet-section="deco"]');
  check("꾸미기 화면: 가진 장식은 그대로 보이고 꾸미기 쉬는 중 안내", (await closet.innerText()).includes("나무 벤치") && (await closet.innerText()).includes("쉬고 있어요") && (await closet.locator('a[href*="deco=1"]').count()) === 0);
  check("놓아 둔 장식 데이터는 남음 (DB)", (await placed()) === "0:deco_bench", await placed());
}

// ── 친구 마을 구경: Q가 P의 블로그 → [🏘 마을 구경] → P의 마을 ──
{
  const page = q.page;
  await page.goto(`${BASE}/@${P}`);
  const visit = page.locator("[data-visit-town]");
  check("남의 블로그에 [🏘 마을 구경]", (await visit.getAttribute("href")) === `/town/${P}`);
  await page.getByRole("button", { name: "+ 이웃 추가" }).click();
  await page.getByRole("button", { name: "✓ 이웃" }).waitFor({ timeout: 10000 });
  // P도 Q를 이웃·즐겨찾기로 두고 Q의 집을 7번 자리에 골라 두었다 (TOWN-18): P의 마을에서는 P가 고른 자리를 쓴다
  await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite, town_lot) VALUES ($1, $2, true, 7)", [p.uid, q.uid]);
  await visit.click();
  await page.waitForURL(`${BASE}/town/${P}`, { timeout: 20000 });
  const banner = page.locator("[data-host-banner]");
  await banner.waitFor({ timeout: 20000 });
  check("위에 `P님의 마을`과 [🏠 내 마을로]", (await banner.innerText()).includes(`${P}님의 마을`) && (await banner.getByRole("link", { name: "🏠 내 마을로" }).getAttribute("href")) === "/town");
  check("P의 마을을 그림 (data-town-host)", (await page.locator("[data-town-host]").getAttribute("data-town-host")) === P);
  check("탭 제목 `P님의 마을`", (await page.title()) === `${P}님의 마을 | Blogville`, await page.title());
  await page.locator("canvas").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/plaza-visit.png` });

  await menuButton(page).click();
  const menu = page.locator('[data-town-panel="menu"]');
  check("남의 마을 ☰ 메뉴에는 광장 꾸미기·이웃 집 자리 없음", !(await menu.innerText()).includes("광장 꾸미기") && !(await menu.innerText()).includes("이웃 집 자리"));
  await menu.getByRole("button", { name: /텔레포트/ }).click();
  const tp = page.locator('[data-town-panel="teleport"]');
  check("텔레포트 0번 집은 `P의 집`", (await tp.locator('[data-spot="house:0"]').innerText()).includes(`${P}의 집`));
  check("P가 고른 자리: 7번 집은 `Q의 집`", (await tp.locator('[data-spot="house:7"]').innerText()).includes(`${Q}의 집`));
  check("P의 즐겨찾기 Q가 P의 마을을 걷는다 (data-npcs 1)", (await page.locator("canvas").getAttribute("data-npcs")) === "1");

  // 친구 목록의 🏘
  await page.goto(`${BASE}/town`);
  await menuButton(page).click();
  await page.locator('[data-town-panel="menu"]').getByRole("button", { name: /친구 목록/ }).click();
  const row = page.locator(`[data-friend="${P}"]`);
  check("친구 목록에 🏘 마을 구경", (await row.getByRole("link", { name: `${P}의 마을 구경` }).getAttribute("href")) === `/town/${P}`);

  // 내 주소 → 내 마을, 없는 주소·공지 블로그 → 404 (일부러 연 404 화면의 콘솔 오류는 빼고 센다)
  const before404 = q.errors.length;
  await page.goto(`${BASE}/town/${Q}`);
  check("내 주소의 마을 구경 → /town", new URL(page.url()).pathname === "/town");
  const missing = await page.goto(`${BASE}/town/nobody${n}`);
  check("없는 주소 → 404", missing.status() === 404);
  const admin = await one("SELECT b.slug FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.role = 'admin' LIMIT 1");
  if (admin) {
    const r = await page.goto(`${BASE}/town/${admin.slug}`);
    check("공지 블로그(관리자) 마을 → 404", r.status() === 404);
    await page.goto(`${BASE}/@${admin.slug}`);
    check("공지 블로그에는 [🏘 마을 구경] 없음", (await page.locator("[data-visit-town]").count()) === 0);
  }
  q.errors.splice(before404, q.errors.length - before404, ...q.errors.slice(before404).filter((e) => !e.includes("status of 404")));
  await page.goto(`${BASE}/@${Q}`);
  check("내 블로그에는 [🏘 마을 구경] 없음", (await page.locator("[data-visit-town]").count()) === 0);
}

// ── 로그인 안 한 방문자 → 첫 화면, 휴대폰 → 그 회원의 블로그 ──
{
  const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const g = await guest.newPage();
  await g.goto(`${BASE}/town/${P}`);
  check("방문자의 마을 구경 → 첫 화면", new URL(g.url()).pathname === "/");
  await guest.close();

  const ph = await browser.newContext({ ...phone, storageState: await q.ctx.storageState() });
  const pp = await ph.newPage();
  const errors = collectErrors(pp);
  await pp.goto(`${BASE}/town/${P}`);
  check("휴대폰의 마을 구경 → 그 회원의 블로그", await pp.waitForURL(`${BASE}/@${P}`, { timeout: 15000 }).then(() => true, () => false), pp.url());
  check("휴대폰 블로그에는 [🏘 마을 구경]이 안 보임", !(await pp.locator("[data-visit-town]").isVisible()));
  check("휴대폰 콘솔 오류 없음", errors.length === 0, errors.join(" | "));
  await ph.close();
}

check("콘솔 오류 없음", p.errors.length === 0 && q.errors.length === 0, [...p.errors, ...q.errors].join(" | "));

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
