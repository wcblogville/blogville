// 마을 개편 1차 (사용자 요청 2026-10-08): 집 11자리, ☰ 메뉴 텔레포트(정류장은 없앰), 우체통, ☰ 메뉴(프로필·알림·텔레포트·친구), ⭐ 즐겨찾기
// 사용: 개발 서버를 띄운 상태에서 node e2e/town.mjs <스크린샷 폴더>
// 2.5D 마을 (2026-10-11): 이웃 집 자리 고르기(TOWN-18, 서버가 남의 이웃·자리 번호 밖을 거절), 걸어 다니는 이웃(NPC)
// 실행마다 새 회원 A와 이웃 B~L(11명)을 만들고, 이웃 관계·글은 pg로 넣어 준비한다
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
const A = `twa${n}`;
const neighbors = "bcdefghijkl".split("").map((c) => `tw${c}${n}`); // 11명

const userId = async (username) => (await one("SELECT id FROM users WHERE username = $1", [username])).id;
const blogOf = async (username) => (await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [username])).id;

// 이웃 11명 가입 (브라우저 하나로 차례로)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const id of neighbors) {
    const page = await ctx.newPage();
    collectErrors(page);
    await loginDev(page, id);
    await ctx.clearCookies();
    await page.close();
  }
  await ctx.close();
}

// A 가입: 데스크톱
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, A);
const aId = await userId(A);
const ids = Object.fromEntries(await Promise.all(neighbors.map(async (u) => [u, await userId(u)])));
const B = neighbors[0];
const menu = () => page.getByRole("button", { name: /메뉴/ });
const panel = () => page.locator("[data-town-panel]");
async function openMenu(item) {
  if (!(await panel().isVisible())) await menu().click();
  if ((await panel().getAttribute("data-town-panel")) !== "menu") await panel().getByRole("button", { name: "메뉴로" }).click();
  if (item) await panel().getByRole("button", { name: new RegExp(item) }).click();
}

// 이웃이 없을 때: 둘레 10자리는 모두 빈 집터
await page.locator("canvas").waitFor();
await openMenu("텔레포트");
const houseButtons = panel().locator('[data-spot^="house:"]');
// 마을 화면에는 헤더 막대가 없고 Blogville 글자만 뜬다. 회원정보 수정·로그아웃은 ☰ 메뉴 아래 (사용자 요청 2026-10-08)
{
  const banner = page.getByRole("banner");
  // 로고는 도트 글자 그림이라(2026-10-12) 글자 대신 이름이 Blogville인 링크 하나만 보이고 다른 글자는 없다
  check(
    "마을 헤더: Blogville 글자만 (레벨·코인·알림·로그아웃 숨김)",
    (await banner.innerText()).trim() === "" && (await banner.getByRole("link", { name: "Blogville" }).isVisible()) && !(await banner.getByTitle("코인").isVisible()),
    (await banner.innerText()).replace(/\n/g, " "),
  );
  await openMenu();
  const account = await panel().locator("[data-account-links]").innerText();
  check("☰ 메뉴 아래 회원정보 수정·로그아웃", account.includes("회원정보 수정") && account.includes("로그아웃"), account.replace(/\n/g, " "));
  await openMenu("텔레포트");
}
check("텔레포트 목록: 마을 7곳(분수·게시판·상점·농장·낚시터·미용실·옷가게) + 집 11자리", (await panel().locator('[data-spot]:not([data-spot^="house:"])').count()) === 7 && (await houseButtons.count()) === 11);
const disabled = await houseButtons.evaluateAll((els) => els.filter((e) => e.disabled).length);
check("이웃이 없으면 빈 집터 10자리 (누를 수 없음), 내 집은 누를 수 있음", disabled === 10 && (await panel().locator('[data-spot="house:0"]').isEnabled()));
await page.screenshot({ path: `${outDir}/town-teleport.png` });

// 빈 집터: ☰ 이웃 집 자리에서 그 자리로 텔레포트 → 광장에서 Space → 그 자리 고르기 창 (즐겨찾기가 없으면 안내)
await openMenu("이웃 집 자리");
check("이웃 집 자리 창: 1~10번", (await panel().locator("[data-lot]").count()) === 10);
await panel().getByRole("button", { name: "3번 자리로 텔레포트" }).click();
await page.waitForTimeout(800);
await page.keyboard.press("Space");
const picker = page.locator('[data-lot-picker="3"]');
check("광장의 빈 집터에서 Space → 3번 자리 고르기", await picker.waitFor({ timeout: 5000 }).then(() => true, () => false));
check("즐겨찾기가 없으면 안내", await picker.getByText("즐겨찾기한 이웃이 없어요").isVisible());
check("이웃이 없으면 걸어 다니는 이웃도 없음", (await page.locator("canvas").getAttribute("data-npcs")) === "0");
await page.keyboard.press("Escape");

// 프로필: 헤더와 같은 코인, 경험치 n/m
await openMenu("내 프로필");
const coinText = await panel().locator("[data-profile-coins]").innerText();
const expText = await panel().locator("[data-profile-exp]").innerText();
const ledgerCoins = (await one("SELECT COALESCE(SUM(coin_delta), 0)::int AS c FROM point_ledger WHERE user_id = $1", [aId])).c;
check("프로필: 코인이 원장 합계와 같음", Number(coinText.replace(/[^0-9]/g, "")) === ledgerCoins, `${coinText} / ${ledgerCoins}`);
check("프로필: 경험치 `현재 / 필요`", /^[\d,]+ \/ [\d,]+$/.test(expText), expText);

// 알림: 알림 없음 안내와 알림함 링크
await openMenu("알림");
check("알림 창: 알림함 링크", (await panel().getByRole("link", { name: /알림함 전체 보기/ }).getAttribute("href")) === "/notifications");

// 친구: 이웃이 없으면 안내
await openMenu("친구 목록");
check("친구 목록: 이웃 없음 안내", await panel().getByText("아직 이웃이 없어요").isVisible());

// 메뉴 창이 떠 있어도 방향키·WASD로 걷는다 (사용자 요청 2026-10-12 "메뉴 떠있는 상태에서 방향키랑 wasd가 안먹는데")
{
  const canvas = page.locator("canvas");
  const feet = async () => ((await canvas.getAttribute("data-feet")) ?? "0,0").split(",").map(Number);
  await canvas.evaluate((el) => el.dispatchEvent(new CustomEvent("bv-teleport", { detail: "plaza" })));
  await page.waitForTimeout(500);
  await openMenu();
  const hold = async (key, ms = 450) => {
    const [x0, y0] = await feet();
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await page.waitForTimeout(150);
    const [x1, y1] = await feet();
    return [x1 - x0, y1 - y0];
  };
  // 갔다가 되돌아오는 순서라 막힌 곳에 부딪히지 않는다
  const [ax] = await hold("ArrowLeft");
  const [dx] = await hold("d");
  const [, sy] = await hold("s");
  const [, wy] = await hold("w");
  check(
    "메뉴 창이 열린 채로 방향키·WASD로 걷는다",
    (await panel().isVisible()) && ax < -10 && sy > 10 && dx > 10 && wy < -10,
    `←${ax} S${sy} D${dx} W${wy}`,
  );
  await page.screenshot({ path: `${outDir}/town-menu-walk.png` });
  // 창 안 버튼에 포커스를 두고 Enter·Space → 버튼이 눌리고 캐릭터는 건물로 안 들어간다
  const before = await feet();
  await panel().getByRole("button", { name: /내 프로필/ }).focus();
  await page.keyboard.press("Enter");
  check("메뉴 창 버튼 위 Enter → 그 버튼이 눌림", await panel().locator("[data-profile-coins]").isVisible().catch(() => false));
  await panel().getByRole("button", { name: "메뉴로" }).focus();
  await page.keyboard.press(" ");
  check("메뉴 창 버튼 위 Space → 그 버튼이 눌림", (await panel().getAttribute("data-town-panel")) === "menu");
  check("버튼 위 Enter·Space는 게임에 안 간다 (제자리)", JSON.stringify(await feet()) === JSON.stringify(before), `${before} → ${await feet()}`);
  // 창 안 글자 칸에 쓰는 글자(wasd·방향키)는 캐릭터를 움직이지 않는다 (창에 글자 칸이 없어 시험용으로 하나 붙인다)
  await panel().evaluate((el) => {
    const input = document.createElement("input");
    input.setAttribute("data-test-input", "");
    el.append(input);
  });
  const typeFrom = await feet();
  await panel().locator("[data-test-input]").focus();
  await page.keyboard.type("wasdwasd");
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(300);
  await page.keyboard.up("ArrowLeft");
  await page.waitForTimeout(150);
  check(
    "창 안 글자 칸에 쓰면 캐릭터는 안 움직임",
    JSON.stringify(await feet()) === JSON.stringify(typeFrom) && (await panel().locator("[data-test-input]").inputValue()) === "wasdwasd",
    `${typeFrom} → ${await feet()}`,
  );
  await panel().locator("[data-test-input]").evaluate((el) => el.remove());
}
await page.keyboard.press("Escape");
check("Esc로 메뉴 창 닫힘", (await panel().count()) === 0);

// 계단 (사용자 요청 2026-10-11 "계단이 너무 좁아서 안 가지는 길이 많다"): 모든 계단을 방향키로 올라갔다 내려온다.
// 계단 양끝 좌표는 canvas의 data-stairs, 발 위치는 data-feet. 계단 끝으로는 bv-teleport 이벤트로 옮긴다
{
  const canvas = page.locator("canvas");
  const stairs = JSON.parse((await canvas.getAttribute("data-stairs")) ?? "[]");
  const feet = async () => ((await canvas.getAttribute("data-feet")) ?? "0,0").split(",").map(Number);
  /** 방향키로 (tx, ty)까지 걸어간다 (8방향, 60ms마다 방향을 다시 고른다) */
  async function walkTo(tx, ty, ms = 8000) {
    const held = new Set();
    const t0 = Date.now();
    let ok = false;
    while (Date.now() - t0 < ms) {
      const [x, y] = await feet();
      const dx = tx - x;
      const dy = ty - y;
      const d = Math.hypot(dx, dy);
      if (d < 24) {
        ok = true;
        break;
      }
      const want = new Set();
      if (dx > d * 0.38) want.add("ArrowRight");
      if (dx < -d * 0.38) want.add("ArrowLeft");
      if (dy > d * 0.38) want.add("ArrowDown");
      if (dy < -d * 0.38) want.add("ArrowUp");
      for (const k of [...held])
        if (!want.has(k)) {
          await page.keyboard.up(k);
          held.delete(k);
        }
      for (const k of want)
        if (!held.has(k)) {
          await page.keyboard.down(k);
          held.add(k);
        }
      await page.waitForTimeout(60);
    }
    for (const k of held) await page.keyboard.up(k);
    return ok;
  }
  const failed = [];
  for (const [i, [ax, ay, bx, by]] of stairs.entries()) {
    // 헤드리스 브라우저가 잠깐 멈추면(프레임 끊김) 한 번에 멀리 가 버릴 수 있어 한 번은 다시 해 본다
    let fail = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      await canvas.evaluate((el, key) => el.dispatchEvent(new CustomEvent("bv-teleport", { detail: key })), `stair:${i}:a`);
      await page.waitForTimeout(300);
      const up = await walkTo(bx, by);
      const down = up && (await walkTo(ax, ay));
      fail = up && down ? "" : `${i}(${ax},${ay}→${bx},${by}) ${up ? "돌아오기" : "건너기"} 실패, 발 ${(await feet()).join(",")}`;
      if (!fail) break;
    }
    if (fail) failed.push(fail);
    if (i === 1) await page.screenshot({ path: `${outDir}/town-stairs.png` });
  }
  check(`계단 ${stairs.length}곳을 모두 걸어서 오르내림`, stairs.length >= 10 && failed.length === 0, failed.join(" | ") || String(stairs.length));
  // 내 정원: 내 집으로 텔레포트하면 정원 단(높이 2) 위, 계단 하나로 상점 길에 이어진다
  await openMenu("텔레포트");
  await panel().locator('[data-spot="house:0"]').click();
  await page.waitForTimeout(800);
  const [hx, hy] = await feet();
  check("내 집은 동쪽 내 정원 안", hx > 1850 && hx < 2500 && hy > 1200 && hy < 1620, `${hx},${hy}`);
  await page.screenshot({ path: `${outDir}/town-home.png` });
}

// 준비: A가 11명을 이웃으로 추가, B는 A를 맞이웃. B에게 공개 글 2개
for (const [i, u] of neighbors.entries()) {
  await db.query("INSERT INTO follows (follower_id, followee_id, created_at) VALUES ($1, $2, now() - make_interval(mins => $3))", [aId, ids[u], 100 - i]);
}
await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)", [ids[B], aId]);
for (const title of ["B의 첫 글", "B의 둘째 글"]) {
  await db.query("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, $2, '<p>x</p>', 'x')", [await blogOf(B), title]);
}
await page.reload();
await page.locator("canvas").waitFor();

await openMenu("친구 목록");
check("친구 목록: 이웃 11명", (await panel().locator("[data-friend]").count()) === 11);
check("친구 목록: 맞이웃 표시", await panel().locator(`[data-friend="${B}"]`).getByText("서로 이웃").isVisible());

// ⭐ 즐겨찾기: B를 켜면 둘레 집이 생기고 DB가 바뀐다
await panel().getByRole("button", { name: `${B} 즐겨찾기`, exact: true }).click();
await panel().getByRole("button", { name: `${B} 즐겨찾기 끄기` }).waitFor({ timeout: 10000 });
const fav = await one("SELECT is_favorite FROM follows WHERE follower_id = $1 AND followee_id = $2", [aId, ids[B]]);
check("⭐ 누르면 즐겨찾기 저장", fav.is_favorite === true);
await page.waitForLoadState("networkidle");
await openMenu("텔레포트");
check("즐겨찾기한 B의 집이 1번 자리", (await panel().locator('[data-spot="house:1"]').innerText()).includes(`${B}의 집`));

// 10명 제한: 나머지 9명을 DB로 켜고, 11번째를 누르면 안내
await db.query("UPDATE follows SET is_favorite = true WHERE follower_id = $1 AND followee_id = ANY($2)", [aId, neighbors.slice(1, 10).map((u) => ids[u])]);
await page.reload();
await page.locator("canvas").waitFor();
await openMenu("친구 목록");
const last = neighbors[10];
await panel().getByRole("button", { name: `${last} 즐겨찾기`, exact: true }).click();
await panel().getByRole("alert").waitFor({ timeout: 10000 });
check("즐겨찾기 11번째는 `10명까지` 안내, 저장 안 됨", (await panel().getByRole("alert").innerText()).includes("10명까지") &&
  (await one("SELECT is_favorite FROM follows WHERE follower_id = $1 AND followee_id = $2", [aId, ids[last]])).is_favorite === false);
await page.screenshot({ path: `${outDir}/town-friends.png` });

// 텔레포트 목록: 둘레 10자리가 모두 집
await openMenu("텔레포트");
const disabled2 = await houseButtons.evaluateAll((els) => els.filter((e) => e.disabled).length);
check("즐겨찾기 10명이면 빈 집터 없음", disabled2 === 0);

// 걸어 다니는 이웃 (사용자 요청 2026-10-11): 즐겨찾기 10명이 마을을 걷는다. 집 앞에 서 있는 주민은 없다
check("걸어 다니는 이웃 10명 (data-npcs)", (await page.locator("canvas").getAttribute("data-npcs")) === "10");
const walking = await page
  .waitForFunction(() => Number(document.querySelector("canvas")?.dataset.npcWalking) > 0, null, { timeout: 15000 })
  .then(() => true, () => false);
check("이웃이 실제로 걷는다 (data-npc-walking > 0)", walking, await page.locator("canvas").getAttribute("data-npc-walking"));

// 이웃 집 자리 고르기 (TOWN-18): 5번 자리를 눌러 B를 고르면 B가 5번, 5번에 있던 이웃은 B의 옛 자리(1번)로
await page.keyboard.press("Escape");
await openMenu("이웃 집 자리");
await panel().locator('[data-lot="5"]').click();
const sixth = neighbors[4]; // 즐겨찾기 순서 5번째 = 처음엔 5번 자리
check("5번 자리 고르기 창: 지금 사는 이웃 표시", (await panel().locator(`[data-lot-friend="${sixth}"]`).innerText()).includes("지금 이 자리에 살아요"));
await page.screenshot({ path: `${outDir}/town-lot-picker.png` });
await panel().locator(`[data-lot-friend="${B}"]`).click();
await panel().locator("[data-lot]").first().waitFor({ timeout: 10000 });
const lotOf = async (u) => (await one("SELECT town_lot FROM follows WHERE follower_id = $1 AND followee_id = $2", [aId, ids[u]])).town_lot;
check("B를 5번 자리에 (DB)", (await lotOf(B)) === 5, String(await lotOf(B)));
check("5번에 있던 이웃은 B의 옛 자리 1번으로 (맞바꾸기)", (await lotOf(sixth)) === 1, String(await lotOf(sixth)));
await page.waitForLoadState("networkidle");
await page.locator("canvas").waitFor();
await openMenu("텔레포트");
check("텔레포트 5번 집 = B의 집", (await panel().locator('[data-spot="house:5"]').innerText()).includes(`${B}의 집`));

// 서버가 거절: 요청을 가로채 남의 이웃(즐겨찾기 안 한 L)·자리 번호 11로 바꿔 보낸다 → 거절, DB 그대로
for (const [name, rewrite, want] of [
  ["즐겨찾기 안 한 이웃", (body) => body.replace(ids[B], ids[last]), "즐겨찾기한 이웃만"],
  ["자리 번호 11", (body) => body.replace(/,\s*2\s*\]$/, ",11]"), "1~10번"],
]) {
  let forged = false;
  const forge = async (route) => {
    const req = route.request();
    if (!forged && req.method() === "POST" && req.headers()["next-action"]) {
      forged = true;
      return route.continue({ postData: rewrite(req.postData() ?? "") });
    }
    return route.continue();
  };
  await page.route("**/town", forge);
  await openMenu("이웃 집 자리");
  await panel().locator('[data-lot="2"]').click();
  await panel().locator(`[data-lot-friend="${B}"]`).click();
  const alert = panel().getByRole("alert");
  const said = await alert.waitFor({ timeout: 10000 }).then(() => alert.innerText(), () => "");
  await page.unroute("**/town", forge);
  check(`서버가 거절: ${name}`, forged && said.includes(want) && (await lotOf(B)) === 5 && (await lotOf(last)) === null, said);
  await page.keyboard.press("Escape");
}

// 즐겨찾기를 끄면 자리도 비운다
await db.query("UPDATE follows SET town_lot = 9 WHERE follower_id = $1 AND followee_id = $2", [aId, ids[neighbors[8]]]).catch(() => {});
await openMenu("친구 목록");
await panel().getByRole("button", { name: `${neighbors[8]} 즐겨찾기 끄기` }).click();
await panel().getByRole("button", { name: `${neighbors[8]} 즐겨찾기`, exact: true }).waitFor({ timeout: 10000 });
check("⭐를 끄면 집 자리도 비움 (DB)", (await lotOf(neighbors[8])) === null);
await page.keyboard.press("Escape");
await db.query("UPDATE follows SET is_favorite = true WHERE follower_id = $1 AND followee_id = $2", [aId, ids[neighbors[8]]]);
await page.reload();
await page.locator("canvas").waitFor();
await openMenu("텔레포트");

// 정류장은 없앴다 (사용자 요청 2026-10-08): 텔레포트 목록에 정류장 없음
check("텔레포트 목록에 정류장 없음", (await panel().locator('[data-spot="signpost"]').count()) === 0 && !(await panel().innerText()).includes("정류장"));

// 텔레포트 목록에서 B의 집(고른 5번 자리) → 창이 닫히고, 문 앞에서 Space → B의 블로그
await panel().locator('[data-spot="house:5"]').click();
check("텔레포트하면 창이 닫힘", (await panel().count()) === 0);
await page.waitForTimeout(800);
await page.locator("canvas").focus().catch(() => {});
await page.screenshot({ path: `${outDir}/town-house-front.png` });
await page.keyboard.press("Space");
await page.waitForURL(new RegExp(`/@${B}$`), { timeout: 10000 }).catch(() => {});
check("집 앞에서 Space → 그 사람 블로그", page.url().endsWith(`/@${B}`), page.url());

// 따라다니는 동물 (사용자 요청 2026-10-11): 블로그에 전시한 다 키운 동물이 광장에서 나를 따라온다 (data-pet·data-pet-at)
{
  await page.goto(`${BASE}/town`);
  const canvas = page.locator("canvas");
  await canvas.waitFor();
  await page.waitForTimeout(500);
  check("전시한 동물이 없으면 따라오는 동물 없음", (await canvas.getAttribute("data-pet")) === null);
  const pet = await one(
    `INSERT INTO user_animals (user_id, sex, species_id, status, growth, source, hatched_at, grown_at)
     VALUES ($1, 'female', (SELECT id FROM animal_species WHERE code = 'bunny'), 'grown', 0, 'shop', now(), now()) RETURNING id`,
    [aId],
  );
  await db.query("UPDATE blogs SET showcase_animal_id = $2 WHERE owner_id = $1", [aId, pet.id]);
  await page.reload();
  await canvas.waitFor();
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.petAt, null, { timeout: 15000 });
  check("전시한 토끼가 마을에 나온다 (data-pet)", (await canvas.getAttribute("data-pet")) === "animal.bunny", await canvas.getAttribute("data-pet"));
  await canvas.evaluate((el) => el.dispatchEvent(new CustomEvent("bv-teleport", { detail: "plaza" })));
  await page.waitForTimeout(600);
  const xy = async (attr) => ((await canvas.getAttribute(attr)) ?? "0,0").split(",").map(Number);
  // 분수 앞에서 아래(남쪽 계단 길)로 걷는다
  await page.keyboard.down("ArrowDown");
  const midWalk = await page
    .waitForFunction(() => document.querySelector("canvas")?.dataset.petWalk === "walk", null, { timeout: 3000 })
    .then(() => "walk", async () => canvas.getAttribute("data-pet-walk"));
  await page.screenshot({ path: `${outDir}/town-pet-1.png` });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/town-pet-2.png` });
  // 걷는 동안 그림 칸: 착지·기욺·뛰어오름 (2·3·4, 2026-10-11 "펫 따라다니는 모션")
  const walkFrames = new Set();
  for (let i = 0; i < 8; i++) {
    walkFrames.add(await canvas.getAttribute("data-pet-frame"));
    await page.waitForTimeout(45);
  }
  await page.keyboard.up("ArrowDown");
  await page.waitForTimeout(1500);
  const [fx, fy] = await xy("data-feet");
  const [px, py] = await xy("data-pet-at");
  const gap = Math.hypot(fx - px, fy - py);
  check("걸으면 동물도 통통 뛰며 따라온다 (data-pet-walk=walk)", midWalk === "walk", midWalk);
  check("멈추면 동물은 내 뒤(위쪽)에 조금 떨어져 선다", py < fy && gap > 25 && gap < 80 && (await canvas.getAttribute("data-pet-walk")) === "idle", `나 ${fx},${fy} / 동물 ${px},${py}, ${Math.round(gap)}px`);
  check("걸을 때 걷기 그림 칸이 돈다 (2·3·4 중 둘 이상)", [...walkFrames].filter((f) => ["2", "3", "4"].includes(f)).length >= 2, [...walkFrames].join(","));
  const idleFrames = new Set();
  for (let i = 0; i < 24; i++) {
    idleFrames.add(await canvas.getAttribute("data-pet-frame"));
    await page.waitForTimeout(150);
  }
  check("서 있으면 숨쉬기 (0·1을 번갈아)", idleFrames.has("0") && idleFrames.has("1") && idleFrames.size === 2, [...idleFrames].join(","));
  check("멈추면 나를 본다 (data-pet-face)", (await canvas.getAttribute("data-pet-face")) === (px < fx ? "right" : "left"), await canvas.getAttribute("data-pet-face"));
  // 순간 이동하면 동물도 옆으로 온다
  await canvas.evaluate((el) => el.dispatchEvent(new CustomEvent("bv-teleport", { detail: "shop" })));
  await page.waitForTimeout(600);
  const [sx, sy] = await xy("data-feet");
  const [tx, ty] = await xy("data-pet-at");
  check("순간 이동 → 동물도 내 옆", Math.hypot(sx - tx, sy - ty) < 80, `${Math.round(Math.hypot(sx - tx, sy - ty))}px`);
  // 동물 크기 (사용자 요청 2026-10-11 "작은 동물은 작게 큰 동물은 크게"): 토끼는 small, 송아지는 large이고 더 떨어져 선다
  check("토끼는 작은 동물 (data-pet-size=small)", (await canvas.getAttribute("data-pet-size")) === "small", await canvas.getAttribute("data-pet-size"));
  await page.screenshot({ path: `${outDir}/town-pet-small.png` });
  const smallGap = Math.hypot(sx - tx, sy - ty);
  const calf = await one(
    `INSERT INTO user_animals (user_id, sex, species_id, status, growth, source, hatched_at, grown_at)
     VALUES ($1, 'female', (SELECT id FROM animal_species WHERE code = 'calf'), 'grown', 0, 'shop', now(), now()) RETURNING id`,
    [aId],
  );
  await db.query("UPDATE blogs SET showcase_animal_id = $2 WHERE owner_id = $1", [aId, calf.id]);
  // 스킨 (2026-10-11 "펫 종류별로 스킨"): 딸기우유 송아지를 사 두고 입힌다
  const skin = await one("SELECT id, asset_key FROM animal_skins WHERE code = 'calf_strawberry'");
  await db.query("INSERT INTO user_animal_skins (user_id, skin_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [aId, skin.id]);
  await db.query("UPDATE user_animals SET skin_id = $2 WHERE id = $1", [calf.id, skin.id]);
  await page.reload();
  await canvas.waitFor();
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.petAt, null, { timeout: 15000 });
  await canvas.evaluate((el) => el.dispatchEvent(new CustomEvent("bv-teleport", { detail: "shop" })));
  await page.waitForTimeout(600);
  const [cx, cy] = await xy("data-feet");
  const [kx, ky] = await xy("data-pet-at");
  const bigGap = Math.hypot(cx - kx, cy - ky);
  check("입힌 스킨으로 따라온다 (data-pet-skin)", (await canvas.getAttribute("data-pet-skin")) === skin.asset_key, await canvas.getAttribute("data-pet-skin"));
  check("송아지는 큰 동물이고 토끼보다 멀리 선다", (await canvas.getAttribute("data-pet-size")) === "large" && bigGap > smallGap + 10 && bigGap < 120, `토끼 ${Math.round(smallGap)}px / 송아지 ${Math.round(bigGap)}px`);
  await page.screenshot({ path: `${outDir}/town-pet-large.png` });
}

// 방문자: 메뉴에 텔레포트와 로그인만
{
  const g = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const gp = await g.newPage();
  const gErrors = collectErrors(gp);
  await gp.goto(`${BASE}/town`);
  await gp.locator("canvas").waitFor();
  await gp.getByRole("button", { name: /메뉴/ }).click();
  const items = await gp.locator("[data-town-panel]").getByRole("listitem").allInnerTexts();
  check("방문자 메뉴: 텔레포트·로그인", items.length === 2 && items[0].includes("텔레포트") && items[1].includes("로그인"), items.join("|"));
  // 공지사항(관리자) 블로그는 집이 아니다: 공개 글이 있어도 방문자 집 목록에 없음 (사용자 요청 2026-10-08)
  const admin = await one("SELECT p.nickname, b.id AS blog_id FROM users u JOIN profiles p ON p.user_id = u.id JOIN blogs b ON b.owner_id = u.id WHERE u.role = 'admin' LIMIT 1");
  if (admin) {
    await db.query("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, '마을 소식 테스트', '<p>공지</p>', '공지')", [admin.blog_id]);
    await gp.reload();
    await gp.locator("canvas").waitFor();
    await gp.getByRole("button", { name: /메뉴/ }).click();
    await gp.locator("[data-town-panel]").getByRole("button", { name: /텔레포트/ }).click();
    const spots = await gp.locator("[data-town-panel]").innerText();
    check("공지사항 블로그는 마을 집 목록에 없음", !spots.includes(`${admin.nickname}의 집`), spots.replace(/\n/g, " ").slice(0, 120));
    await db.query("DELETE FROM posts WHERE blog_id = $1 AND title = '마을 소식 테스트'", [admin.blog_id]);
  }
  errors.push(...gErrors);
  await g.close();
}

// 휴대폰: ☰ 메뉴(아래 탭)에 내 프로필 숫자·친구 목록 (알림은 아래 탭)
{
  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  errors.push(...collectErrors(mp));
  await loginDev(mp, A);
  await mp.goto(`${BASE}/town?menu=1`);
  const menuBox = mp.locator("[data-town-menu]");
  await menuBox.waitFor();
  const text = await menuBox.innerText();
  const profile = menuBox.locator("[data-menu-profile]");
  check(
    "휴대폰: 내 프로필 Lv·코인·경험치, 친구 목록",
    /Lv\.\d+/.test(await profile.innerText()) && (await profile.locator("[data-profile-coins]").count()) === 1 && (await profile.locator("[data-profile-exp]").count()) === 1 && text.includes("친구 목록") && (await menuBox.locator("[data-friend]").count()) === 11,
  );
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("휴대폰: 가로 스크롤 없음", overflow <= 0, String(overflow));
  await mp.screenshot({ path: `${outDir}/town-phone.png`, fullPage: true });
  await m.close();
}

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
