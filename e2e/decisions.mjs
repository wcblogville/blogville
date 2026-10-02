// 2026-10-02 팀 결정 구현 확인: TOWN-01, GAME-01, GAME-02, GAME-04, GAME-07, SHOP-04, TOWN-02, TOWN-04
// 사용: npm run db:reset && npm run admin:create 후 node e2e/decisions.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const userId = async (username) => (await db.query("SELECT id FROM users WHERE username = $1", [username])).rows[0].id;
const kstDate = (offsetDays) => {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
};

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);

// ── GAME-01: 가입할 때 남자/여자 중 고른 캐릭터 하나만 받고 장착 ──
await loginDev(page, "decide01", "여자 주민");
await page.goto(`${BASE}/closet`);
const characterNames = await page.locator("section", { hasText: "내 캐릭터" }).getByRole("button").allInnerTexts();
check("GAME-01 가입하면 고른 캐릭터 1개만 보유", characterNames.length === 1, characterNames.join(", ").replace(/\n/g, " "));
check("GAME-01 고른 캐릭터(여자 주민)가 장착됨", characterNames.some((t) => t.includes("✓") && t.includes("여자 주민")));

// ── SHOP-04: 장착 저장 확인 표시 (바꿔 낄 캐릭터를 하나 더 넣어 둔다) ──
await db.query("INSERT INTO user_items (user_id, item_id) SELECT u.id, i.id FROM users u, items i WHERE u.username = 'decide01' AND i.code = 'char_cat'");
await page.reload();
await page.getByRole("button", { name: /고양이/ }).click();
const saved = await page.getByRole("status").filter({ hasText: "저장했어요" }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
check("SHOP-04 장착하면 '저장했어요' 표시", saved);
await page.screenshot({ path: `${outDir}/50-closet-saved.png` });
await page.waitForTimeout(2300);
check("SHOP-04 '저장했어요'는 2초 뒤 사라짐", (await page.getByRole("status").innerText()).trim() === "");

// ── GAME-04: 달이 바뀌어도 연속 일수가 맞게 보이고, 7일째 보너스 ──
const uid = await userId("decide01");
await db.query("INSERT INTO attendances (user_id, date, streak) VALUES ($1, $2, 6)", [uid, kstDate(-1)]);
await page.goto(`${BASE}/attendance`);
check("GAME-04 어제까지 6일 연속이면 '현재 연속 6일'", await page.getByText("현재 연속 6일").isVisible());
const before = await coins(page);
// 오늘 1~3등으로 출석하면 🪙 100이 더 붙는다 (GAME-04 출석 1~3등 보너스). db:reset 직후면 이 회원이 1등이다
const attendedToday = (await db.query("SELECT count(*)::int AS n FROM attendances WHERE date = $1", [kstDate(0)])).rows[0].n;
const rankBonus = attendedToday < 3 ? 100 : 0;
await page.getByRole("button", { name: /출석하고/ }).click();
await page.getByText(/출석 완료! 7일 연속/).waitFor();
check("GAME-04 7일째 출석 보너스 문구", await page.getByText("7일 연속 보너스 포함").isVisible());
await page.reload();
check(`GAME-04 7일째 코인 +${70 + rankBonus} (20 + 보너스 50${rankBonus ? " + 1~3등 100" : ""})`, (await coins(page)) - before === 70 + rankBonus, `${before} → ${await coins(page)}`);
// 마지막 출석이 그저께면 끊김
await db.query("DELETE FROM attendances WHERE user_id = $1", [uid]);
await db.query("INSERT INTO attendances (user_id, date, streak) VALUES ($1, $2, 4)", [uid, kstDate(-2)]);
await page.goto(`${BASE}/attendance`);
check("GAME-04 그저께가 마지막이면 '연속 출석이 끊겼어요'", await page.getByText("연속 출석이 끊겼어요").isVisible());
await page.screenshot({ path: `${outDir}/51-attendance-broken.png` });

// ── GAME-07: 내역 화면 (헤더 코인을 누르면 이동, 구매에 아이템 이름) ──
await page.goto(`${BASE}/shop`);
await page.locator("article", { hasText: "바닷가" }).getByRole("button", { name: "사기" }).click();
await page.getByRole("status").filter({ hasText: "샀어요" }).waitFor();
await page.getByRole("banner").getByTitle("코인").click();
await page.waitForURL(/\/wallet/);
const walletText = await page.locator("main").innerText();
check("GAME-07 헤더 코인을 누르면 내역 화면", page.url().endsWith("/wallet"));
check("GAME-07 구매 기록에 아이템 이름", /아이템 구매 · 바닷가/.test(walletText) && walletText.includes("−120"));
check("GAME-07 가입 축하·출석·보너스 기록", ["가입 축하", "출석", "연속 출석 보너스"].every((t) => walletText.includes(t)));
const walletCoins = Number(walletText.match(/🪙 ([\d,]+)/)[1].replace(/,/g, ""));
check("GAME-07 내역 화면 코인 = 헤더 코인", walletCoins === (await coins(page)), `${walletCoins}`);
await page.screenshot({ path: `${outDir}/52-wallet.png`, fullPage: true });

// ── GAME-02: 최고 레벨 99 ──
await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta) VALUES ($1, 'signup', 600000, 0)", [uid]);
await page.goto(`${BASE}/closet`);
const header = await page.getByRole("banner").innerText();
check("GAME-02 경험치 60만이어도 Lv.99", header.includes("Lv.99"));
check("GAME-02 진행 막대 MAX", await page.getByText("MAX", { exact: true }).isVisible());

// ── TOWN-04: 공개 글이 없는 블로그는 광장에 안 보임 ──
const other = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const op = await other.newPage();
await loginDev(op, "quiet01", "남자 주민");
await page.goto(`${BASE}/town`);
const neighborsBefore = await page.locator("section", { hasText: "이웃집" }).innerText().catch(() => "");
check("TOWN-04 글 없는 블로그(quiet01)는 이웃집에 없음", !neighborsBefore.includes("quiet01"));
await op.goto(`${BASE}/write`);
await op.locator(".ProseMirror").waitFor();
await op.getByPlaceholder("제목").fill("첫 글");
await op.locator(".ProseMirror").click();
await op.keyboard.type("광장에 집이 생기는지 확인하는 글이에요.");
await op.getByRole("button", { name: "발행하기" }).click();
await op.waitForURL(/\/@quiet01\/\d+/);
await page.goto(`${BASE}/town`);
const neighborsAfter = await page.locator("section", { hasText: "이웃집" }).innerText();
check("TOWN-04 공개 글을 쓰면 이웃집에 나타남", neighborsAfter.includes("quiet01"));

// ── TOWN-02: 가상 조이스틱 (터치 화면에만) ──
await page.goto(`${BASE}/town`);
await page.waitForSelector("canvas");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/53-town-desktop.png` });
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await mobile.newPage();
const mErrors = collectErrors(mp);
await loginDev(mp, "decide01");
await mp.goto(`${BASE}/town`);
const canvas = mp.locator("canvas");
await canvas.waitFor();
await mp.waitForTimeout(1500);
check("TOWN-02 휴대폰은 pointer: coarse", await mp.evaluate(() => matchMedia("(pointer: coarse)").matches));
await mp.screenshot({ path: `${outDir}/54-town-mobile-before.png` });
// 조이스틱 중심(왼쪽 아래)에서 오른쪽 위로 끌기
const box = await canvas.boundingBox();
const jx = box.x + 28 + 56;
const jy = box.y + box.height - 28 - 56;
await mp.mouse.move(jx, jy);
await mp.mouse.down();
await mp.mouse.move(jx + 50, jy - 30, { steps: 5 });
await mp.waitForTimeout(250);
await mp.screenshot({ path: `${outDir}/55-town-mobile-dragging.png` });
await mp.waitForTimeout(800);
await mp.mouse.up();
await mp.waitForTimeout(400);
await mp.screenshot({ path: `${outDir}/56-town-mobile-after.png` });

// ── TOWN-01: 광장이 메인. 헤더에는 이동 메뉴가 없고, 광장 밖에서는 "나가기"로 돌아온다 ──
await page.goto(`${BASE}/town`);
const banner = page.getByRole("banner");
check("TOWN-01 헤더에 이동 메뉴 없음", (await banner.getByRole("link", { name: /마을 소식|상점|꾸미기|글쓰기/ }).count()) === 0);
check("TOWN-01 광장에서는 나가기 버튼 없음", (await banner.getByRole("link", { name: /나가기/ }).count()) === 0);
for (const path of ["/feed", "/attendance", "/shop", "/farm"]) {
  await page.goto(`${BASE}${path}`);
  await banner.getByRole("link", { name: /나가기/ }).click();
  await page.waitForURL(/\/town$/);
  check(`TOWN-01 ${path} → 나가기 → 광장`, page.url().endsWith("/town"));
}

check("콘솔 오류 없음", errors.length === 0 && mErrors.length === 0, [...errors, ...mErrors].join(" | "));
console.log(results.join("\n"));
await browser.close();
await db.end();
