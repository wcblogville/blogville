// 광장 꾸미기와 친구 마을 구경 (사용자 요청 2026-10-09)
// 사용: 개발 서버를 띄운 상태에서 node e2e/plaza.mjs <스크린샷 폴더>
// 실행마다 새 회원 P(꾸미는 사람)·Q(놀러 가는 친구)를 만든다. DB는 .env.local의 DATABASE_URL로 확인한다.
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

/** 조건이 맞을 때까지 (최대 10초) */
async function until(fn, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const p = await member(P);
const q = await member(Q);
const placed = async () =>
  (
    await db.query("SELECT d.slot, i.code FROM town_decorations d JOIN items i ON i.id = d.item_id WHERE d.user_id = $1 ORDER BY d.slot", [p.uid])
  ).rows
    .map((r) => `${r.slot}:${r.code}`)
    .join(",");

// ── 상점: 🌷 광장 장식 구역에서 벤치·꽃밭 사기 ──
{
  const page = p.page;
  await page.goto(`${BASE}/shop`);
  const section = page.locator('[data-shop-section="deco"]');
  check("상점에 🌷 광장 장식 구역", (await section.count()) === 1 && (await section.innerText()).includes("나무 벤치"));
  const card = (name) => page.locator("article", { has: page.getByRole("heading", { name, exact: true }) });
  await card("나무 벤치").getByRole("button", { name: "사기" }).click();
  await page.getByRole("status").filter({ hasText: "샀어요" }).waitFor({ timeout: 10000 });
  check("산 안내의 [🌷 광장으로] → 꾸미기 창", (await page.getByRole("link", { name: "🌷 광장으로" }).getAttribute("href")) === "/town?deco=1");
  await page.waitForLoadState("networkidle");
  await card("꽃밭").getByRole("button", { name: "사기" }).click();
  const owned = async () =>
    (await one("SELECT count(*)::int AS n FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.type = 'deco'", [p.uid])).n;
  check("장식 2개를 가짐 (DB)", await until(async () => (await owned()) === 2));
  await page.goto(`${BASE}/closet`);
  const closet = page.locator('[data-closet-section="deco"]');
  check("꾸미기 화면에 🌷 광장 장식 (벤치·꽃밭)", (await closet.count()) === 1 && (await closet.innerText()).includes("나무 벤치") && (await closet.innerText()).includes("꽃밭"));
}

// ── 광장 꾸미기: ?deco=1로 창이 열리고, Lv.1은 4자리 ──
const panel = p.page.locator('[data-town-panel="deco"]');
const slotBtn = (i) => panel.locator(`[data-deco-slot="${i}"]`);
const item = (key) => panel.locator(`[data-deco-item="${key}"]`);
const game = p.page.locator("[data-decorations]");
{
  const page = p.page;
  await page.goto(`${BASE}/town?deco=1`);
  await panel.waitFor({ timeout: 20000 });
  const enabled = [];
  for (let i = 0; i < 8; i++) enabled.push(await slotBtn(i).isEnabled());
  check("Lv.1: 1~4번 자리 열림, 5~8번 잠김", enabled.join() === "true,true,true,true,false,false,false,false", enabled.join());
  check("잠긴 자리에 열리는 레벨 (5번 Lv.10, 7번 Lv.20)", (await slotBtn(4).innerText()).includes("Lv.10") && (await slotBtn(6).innerText()).includes("Lv.20"));

  // 요청 바꿔 보내기에 쓸 진짜 요청을 하나 잡는다 (그대로 보낸다)
  let captured = null;
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"] && !captured) captured = { url: req.url(), headers: req.headers(), body: req.postData() ?? "" };
    return route.continue();
  });
  await slotBtn(0).click();
  await item("deco.bench").click();
  await panel.getByRole("status").filter({ hasText: "1번 자리에 놓았어요" }).waitFor({ timeout: 10000 });
  await page.unroute("**/*");
  check("1번 자리에 벤치 → DB", (await placed()) === "0:deco_bench", await placed());
  check("광장에 바로 그려짐 (게임을 다시 만들지 않음)", (await game.getAttribute("data-decorations")) === "0:deco.bench", await game.getAttribute("data-decorations"));

  // 같은 벤치를 2번 자리로 → 1번은 비고, 1번에 꽃밭
  await slotBtn(1).click();
  check("다른 자리에 있는 장식은 `1번에서 옮기기`", (await item("deco.bench").innerText()).includes("1번에서 옮기기"));
  await item("deco.bench").click();
  check("벤치를 2번 자리로 옮김", await until(async () => (await placed()) === "1:deco_bench"), await placed());
  await slotBtn(0).click();
  await item("deco.flowerbed").click();
  check("1번 꽃밭, 2번 벤치", await until(async () => (await placed()) === "0:deco_flowerbed,1:deco_bench"), await placed());
  // 2번 비우기 → 3번에 벤치
  await slotBtn(1).click();
  await panel.locator("[data-deco-clear]").click();
  check("2번 자리 비우기", await until(async () => (await placed()) === "0:deco_flowerbed"), await placed());
  await slotBtn(2).click();
  await item("deco.bench").click();
  check("3번 자리에 벤치", await until(async () => (await placed()) === "0:deco_flowerbed,2:deco_bench"), await placed());
  check("광장 그림도 같음", await until(async () => (await game.getAttribute("data-decorations")) === "0:deco.flowerbed,2:deco.bench"), await game.getAttribute("data-decorations"));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/plaza-deco.png` });

  // 조작: 잠긴 자리(5번), 없는 자리, 안 가진 장식, 이상한 값 → DB 그대로, 500 없음
  const benchId = (await one("SELECT id FROM items WHERE code = 'deco_bench'")).id;
  const windmillId = (await one("SELECT id FROM items WHERE code = 'deco_windmill'")).id;
  const statuses = [];
  for (const args of [[4, benchId], [8, benchId], [-1, benchId], [3, windmillId], [3, "abc"], ["1", benchId]]) {
    // 요청 번호(x-nextjs-request-id)는 빼고 보낸다: 같은 번호로 여러 번 보내면 개발 서버가 이미 닫힌 브라우저 디버그 채널에
    // 그 응답의 디버그 조각을 또 보내 "Cannot write to a CLOSED writable stream" 콘솔 오류가 난다 (시험이 만든 오류, 앱과 무관)
    const headers = Object.fromEntries(Object.entries(captured.headers).filter(([k]) => k !== "x-nextjs-request-id"));
    const r = await page.request.post(captured.url, { headers, data: JSON.stringify(args) });
    statuses.push(r.status());
  }
  check("잠긴 자리·없는 자리·안 가진 장식·이상한 값 → DB 그대로, 500 없음", captured && (await placed()) === "0:deco_flowerbed,2:deco_bench" && statuses.every((s) => s < 500), `${statuses} / ${captured?.body}`);

  // ☰ 메뉴의 광장 꾸미기 칸: 놓은 수 / 열린 자리
  await page.goto(`${BASE}/town`);
  await menuButton(page).click();
  const menu = page.locator('[data-town-panel="menu"]');
  check("☰ 메뉴에 🌷 광장 꾸미기 (장식 2/4자리)", (await menu.innerText()).includes("광장 꾸미기") && (await menu.innerText()).includes("장식 2/4자리"), await menu.innerText());

  // Lv.10이 되면 6자리
  await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', 900, 0)", [p.uid]);
  await page.goto(`${BASE}/town?deco=1`);
  await panel.waitFor({ timeout: 20000 });
  const enabled10 = [];
  for (let i = 0; i < 8; i++) enabled10.push(await slotBtn(i).isEnabled());
  check("Lv.10: 6자리 열림, 7·8번은 Lv.20", enabled10.join() === "true,true,true,true,true,true,false,false" && (await slotBtn(7).innerText()).includes("Lv.20"), enabled10.join());
}

// ── 친구 마을 구경: Q가 P의 블로그 → [🏘 마을 구경] → P의 마을 ──
{
  const page = q.page;
  await page.goto(`${BASE}/@${P}`);
  const visit = page.locator("[data-visit-town]");
  check("남의 블로그에 [🏘 마을 구경]", (await visit.getAttribute("href")) === `/town/${P}`);
  await page.getByRole("button", { name: "+ 이웃 추가" }).click();
  await page.getByRole("button", { name: "✓ 이웃" }).waitFor({ timeout: 10000 });
  await visit.click();
  await page.waitForURL(`${BASE}/town/${P}`, { timeout: 20000 });
  const banner = page.locator("[data-host-banner]");
  await banner.waitFor({ timeout: 20000 });
  check("위에 `P님의 마을`과 [🏠 내 마을로]", (await banner.innerText()).includes(`${P}님의 마을`) && (await banner.getByRole("link", { name: "🏠 내 마을로" }).getAttribute("href")) === "/town");
  const qGame = page.locator("[data-decorations]");
  check("P가 놓은 장식이 보임", (await qGame.getAttribute("data-decorations")) === "0:deco.flowerbed,2:deco.bench" && (await qGame.getAttribute("data-town-host")) === P, await qGame.getAttribute("data-decorations"));
  check("탭 제목 `P님의 마을`", (await page.title()) === `${P}님의 마을 | Blogville`, await page.title());
  await page.locator("canvas").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/plaza-visit.png` });

  await menuButton(page).click();
  const menu = page.locator('[data-town-panel="menu"]');
  check("남의 마을 ☰ 메뉴에는 광장 꾸미기 없음", !(await menu.innerText()).includes("광장 꾸미기"));
  await menu.getByRole("button", { name: /텔레포트/ }).click();
  const tp = page.locator('[data-town-panel="teleport"]');
  check("텔레포트 0번 집은 `P의 집`", (await tp.locator('[data-spot="house:0"]').innerText()).includes(`${P}의 집`));
  await page.goto(`${BASE}/town?deco=1`);
  check("남의 마을에서 나와 내 마을 ?deco=1은 내 꾸미기 창", await page.locator('[data-town-panel="deco"]').waitFor({ timeout: 20000 }).then(() => true, () => false));

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
