// 미용실(/salon)·옷가게(/clothes)와 광장 걷기 그림 (사용자 요청 2026-10-11, SHOP-07·08, TOWN-17)
// 사용: 개발 서버를 띄운 상태에서 node e2e/style.mjs <스크린샷 폴더>
// 실행마다 새 회원 S를 만든다. DB는 .env.local의 DATABASE_URL로 확인한다 (아이템은 npm run db:seed).
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
const S = `st${Date.now() % 100_000_000}`;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, S, "여자 주민");
const uid = (await one("SELECT id FROM users WHERE username = $1", [S])).id;

const itemId = async (code) => (await one("SELECT id FROM items WHERE code = $1", [code])).id;
const coins = async () => (await one("SELECT COALESCE(SUM(coin_delta), 0)::int AS c FROM point_ledger WHERE user_id = $1", [uid])).c;
/** 코인을 딱 n개로 맞춘다 (시험용 원장 한 줄) */
async function setCoins(n) {
  const diff = n - (await coins());
  if (diff !== 0) await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', 0, $2)", [uid, diff]);
}
const owns = async (code) =>
  (await one("SELECT count(*)::int AS n FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = $2 AND ui.quantity > 0", [uid, code])).n === 1;
const equipped = async (slot) =>
  (await one("SELECT i.code FROM avatar_equips e JOIN items i ON i.id = e.item_id WHERE e.user_id = $1 AND e.slot = $2", [uid, slot]))?.code ?? null;
const purchases = async () => (await one("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'purchase'", [uid])).n;

const option = (id) => page.locator(`[data-style-option="${id}"]`);
const apply = page.locator("[data-style-apply]");
const status = page.locator("[data-style-bill] [role=status]");
const tab = (name) => page.getByRole("tab", { name });
async function applyAndWait(text) {
  await apply.click();
  return status.filter({ hasText: text }).waitFor({ timeout: 10000 }).then(() => true, () => false);
}

await setCoins(300);
const pony = await itemId("hair_pony");
const bob = await itemId("hair_bob");
const curly = await itemId("hair_curly");
const spiky = await itemId("hair_spiky");
const pink = await itemId("haircolor_pink");
const lavender = await itemId("haircolor_lavender");

// ── 미용실: 유료 머리 사기 + 적용 ──
let captured = null;
{
  await page.goto(`${BASE}/salon`);
  await page.locator('[data-style-studio="salon"]').waitFor({ timeout: 20000 });
  check("미용실 제목", (await page.getByRole("heading", { level: 1 }).innerText()).includes("미용실"));
  check("탭: 머리 모양·머리 색", (await tab("머리 모양").count()) === 1 && (await tab("머리 색").count()) === 1);
  check("처음엔 `지금 모습이에요`", (await apply.getAttribute("data-style-apply")) === "same");
  check("코인 300", (await page.locator("[data-style-coins]").innerText()) === "300");

  await option(pony).click();
  check("포니테일 고르면 거울이 바로 바뀜", (await page.locator("[data-mirror]").getAttribute("data-look")).includes("hair.pony"));
  check("계산서: 🪙 60 내고 적용하기", (await apply.getAttribute("data-style-apply")) === "buy" && (await apply.innerText()).includes("🪙 60"), await apply.innerText());
  await tab("머리 색").click();
  await option(lavender).click();
  check("Lv.2 머리 색은 잠김", (await apply.getAttribute("data-style-apply")) === "locked" && (await apply.isDisabled()));
  await option(pink).click();
  check("핑크 더하면 🪙 120", (await apply.innerText()).includes("🪙 120"), await apply.innerText());
  await page.screenshot({ path: `${outDir}/style-salon-bill.png`, fullPage: true });

  // 요청을 바꿔 보낼 때 쓸 진짜 Server Action 요청을 하나 잡는다
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"] && !captured) captured = { url: req.url(), headers: req.headers() };
    return route.continue();
  });
  check("사고 적용하면 안내", await applyAndWait("샀어요"), await status.innerText());
  await page.unroute("**/*");
  check("DB: 포니테일·핑크를 가지고 입음", (await owns("hair_pony")) && (await owns("haircolor_pink")) && (await equipped("hair")) === "hair_pony" && (await equipped("hair_color")) === "haircolor_pink");
  check("DB: 코인 120 줄고 구매 2줄", (await coins()) === 180 && (await purchases()) === 2, `${await coins()} / ${await purchases()}`);
  check("화면 코인 180", (await page.locator("[data-style-coins]").innerText()) === "180");
  check("적용 뒤 `지금 모습이에요`", (await apply.getAttribute("data-style-apply")) === "same");

  // 무료 머리(단발): 코인 없이 받고 입는다. 0코인 원장 줄은 쓰지 않는다
  await tab("머리 모양").click();
  await option(bob).click();
  check("무료 머리는 `✨ 적용하기`", (await apply.getAttribute("data-style-apply")) === "apply");
  check("무료 머리 적용", await applyAndWait("어울려요"));
  check("DB: 단발을 받고 입음, 코인·구매 줄 그대로", (await owns("hair_bob")) && (await equipped("hair")) === "hair_bob" && (await coins()) === 180 && (await purchases()) === 2);

  // 가진 포니테일로 돌아가기: 다시 사지 않는다
  await option(pony).click();
  check("가진 머리는 `✨ 적용하기`", (await apply.getAttribute("data-style-apply")) === "apply" && (await option(pony).getAttribute("data-owned")) !== null);
  check("가진 머리 다시 입기", await applyAndWait("어울려요"));
  check("DB: 포니테일, 코인 그대로", (await equipped("hair")) === "hair_pony" && (await coins()) === 180 && (await purchases()) === 2);
}

// ── 서버가 막는 것: 안 산 것을 0코인으로, 코인 부족, 잠긴 레벨, 다른 가게 부위 ──
{
  // 요청 번호(x-nextjs-request-id)는 빼고 보낸다 (plaza.mjs와 같은 이유: 개발 서버 디버그 채널 오류)
  const headers = captured ? Object.fromEntries(Object.entries(captured.headers).filter(([k]) => k !== "x-nextjs-request-id")) : {};
  const send = async (selection, pay) => (await page.request.post(captured.url, { headers, data: JSON.stringify([selection, pay]) })).status();
  const before = async () => [await equipped("hair"), await equipped("hair_color"), await coins(), await purchases(), await owns("hair_curly"), await owns("hair_spiky")].join();
  const snapshot = await before();
  const statuses = [];
  statuses.push(await send({ hair: curly }, 0)); // 안 가진 유료 머리를 0코인으로 → 가지고 있지 않은 아이템
  statuses.push(await send({ hair: spiky }, 0));
  statuses.push(await send({ hair: lavender }, 80)); // 머리 모양 칸에 머리 색 → 이 가게 아이템 아님
  statuses.push(await send({ outfit: await itemId("outfit_pajama") }, 90)); // 옷가게 부위
  statuses.push(await send({ hair_color: lavender }, 80)); // Lv.2 잠김
  check("안 가진 것(0코인)·다른 부위·잠긴 레벨 → DB 그대로, 500 없음", Boolean(captured) && (await before()) === snapshot && statuses.every((s) => s < 500), `${statuses}`);

  await setCoins(10);
  const snap2 = await before();
  statuses.push(await send({ hair: spiky }, 40)); // 코인 부족
  check("코인 부족 → DB 그대로", (await before()) === snap2 && !(await owns("hair_spiky")) && (await coins()) === 10, `${await coins()}`);

  // 화면도 막는다
  await page.reload();
  await page.locator('[data-style-studio="salon"]').waitFor({ timeout: 20000 });
  await option(spiky).click();
  check("화면: `코인이 30개 부족해요`, 버튼 꺼짐", (await apply.getAttribute("data-style-apply")) === "short" && (await apply.innerText()).includes("30개 부족") && (await apply.isDisabled()));
  await setCoins(300);
}

// ── 옷가게: 옷 사서 입기 → 광장 캐릭터에도 ──
{
  await page.goto(`${BASE}/clothes`);
  await page.locator('[data-style-studio="clothes"]').waitFor({ timeout: 20000 });
  check("옷가게 탭: 옷·모자·소품", (await page.getByRole("tab").count()) === 3);
  const pajama = await itemId("outfit_pajama");
  await option(pajama).click();
  check("잠옷 🪙 90", (await apply.innerText()).includes("🪙 90"), await apply.innerText());
  check("옷 사고 입기", await applyAndWait("샀어요"), await status.innerText());
  check("DB: 잠옷 입음, 머리는 그대로", (await equipped("outfit")) === "outfit_pajama" && (await equipped("hair")) === "hair_pony" && (await coins()) === 210);
  await page.screenshot({ path: `${outDir}/style-clothes.png`, fullPage: true });

  // 옷 벗기 (없음)
  await option("none").click();
  check("옷 벗기 적용", await applyAndWait("어울려요"));
  check("DB: 옷 칸 비움, 잠옷은 그대로 가짐", (await equipped("outfit")) === null && (await owns("outfit_pajama")));
  await option(pajama).click();
  await applyAndWait("어울려요");
}

// ── 광장: 입은 모습 + 걷기 그림 (TOWN-17) ──
{
  await page.goto(`${BASE}/town`);
  const canvas = page.locator("canvas");
  await canvas.waitFor({ timeout: 20000 });
  const look = await page.locator("[data-player-look]").getAttribute("data-player-look");
  check("광장 캐릭터에 머리·옷", look.includes("hair.pony") && look.includes("haircolor.pink") && look.includes("outfit.pajama"), look);
  await page.waitForTimeout(800);
  await canvas.click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.down("ArrowLeft");
  const walking = await page
    .waitForFunction(() => document.querySelector("canvas")?.dataset.walk === "walk-left", null, { timeout: 5000 })
    .then(() => true, () => false);
  await page.keyboard.up("ArrowLeft");
  check("왼쪽으로 걸으면 `walk-left`", walking, await canvas.getAttribute("data-walk"));
  const idle = await page
    .waitForFunction(() => document.querySelector("canvas")?.dataset.walk === "idle-left", null, { timeout: 5000 })
    .then(() => true, () => false);
  check("멈추면 그 방향으로 서 있기 `idle-left`", idle, await canvas.getAttribute("data-walk"));
  await page.keyboard.down("ArrowDown");
  const down = await page
    .waitForFunction(() => document.querySelector("canvas")?.dataset.walk === "walk-down", null, { timeout: 5000 })
    .then(() => true, () => false);
  await page.keyboard.up("ArrowDown");
  check("아래로 걸으면 `walk-down`", down, await canvas.getAttribute("data-walk"));

  // 텔레포트 목록에 미용실·옷가게
  await page.locator('button[aria-haspopup="dialog"]').click();
  await page.locator('[data-town-panel="menu"]').getByRole("button", { name: /텔레포트/ }).click();
  const tp = page.locator('[data-town-panel="teleport"]');
  check("텔레포트에 💇 미용실·👗 옷가게", (await tp.locator('[data-spot="salon"]').count()) === 1 && (await tp.locator('[data-spot="clothes"]').count()) === 1);
}

// ── 방문자·휴대폰 ──
{
  const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const g = await guest.newPage();
  for (const path of ["/salon", "/clothes"]) {
    await g.goto(`${BASE}${path}`);
    check(`방문자의 ${path} → 첫 화면`, new URL(g.url()).pathname === "/");
  }
  await guest.close();

  const ph = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
  const pp = await ph.newPage();
  const phoneErrors = collectErrors(pp);
  for (const path of ["salon", "clothes"]) {
    await pp.goto(`${BASE}/${path}`);
    await pp.locator(`[data-style-studio="${path}"]`).waitFor({ timeout: 20000 });
    const wide = await pp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`휴대폰 /${path}: 가로 스크롤 없음`, !wide);
  }
  await pp.goto(`${BASE}/town?menu=1`);
  const menu = pp.locator("[data-town-menu]");
  await menu.waitFor({ timeout: 20000 });
  check("휴대폰 ☰ 메뉴에 미용실·옷가게", (await menu.locator('a[href="/salon"]').count()) === 1 && (await menu.locator('a[href="/clothes"]').count()) === 1);
  check("휴대폰 ☰ 메뉴에 광장 꾸미기 없음", !(await menu.innerText()).includes("광장 꾸미기"));
  check("휴대폰 콘솔 오류 없음", phoneErrors.length === 0, phoneErrors.join(" | "));
  await ph.close();
}

check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
