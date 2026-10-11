// 마을 게시판 출석 체크 창 + 광장 이름표 + 블로그 주인 도구·위젯 (사용자 요청 2026-10-11)
// "마을 게시판 들어가면 출석체크 창 없음, 내 블로그 들어갔을 때 글쓰기랑 다른 부가기능들이 부족한 것 같음,
//  옷가게나 상점 아래 적혀있는 부가 설명들은 없애줘"
// 사용: 개발 서버를 띄운 상태에서 node e2e/board-blog.mjs <스크린샷 폴더>
// 실행마다 새 회원 둘(주인 O, 손님 V)을 만들고, 출석·글·댓글·태그·방문은 pg로 넣어 준비한다
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
const allErrors = [];
const n = Date.now() % 100_000_000;
const OWNER = `bo${n}`;
const VISITOR = `bv${n}`;
const desktop = { viewport: { width: 1280, height: 900 } };
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };

const kstDate = (offset = 0) => new Date(Date.now() + 9 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);
const TODAY = kstDate();

async function fresh(opts = desktop, storageState) {
  const ctx = await browser.newContext({ ...opts, storageState });
  const page = await ctx.newPage();
  allErrors.push(collectErrors(page));
  return { ctx, page };
}

const own = await fresh();
await loginDev(own.page, OWNER);
const vis = await fresh();
await loginDev(vis.page, VISITOR, "여자 주민");
const owner = await one("SELECT u.id AS user_id, b.id AS blog_id, b.slug FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = $1", [OWNER]);
const visitor = await one("SELECT u.id AS user_id FROM users u WHERE u.username = $1", [VISITOR]);

// ══ 1. 마을 게시판 → 출석 체크 창 ══
{
  // 오늘 출석을 지우고 그저께 1일차·어제 2일차를 넣는다 → 다음 화면에서 오늘 3일차 자동 출석
  const uid = owner.user_id;
  await db.query("DELETE FROM point_ledger WHERE user_id = $1 AND reason = 'attendance' AND ref_id = $2", [uid, TODAY]);
  await db.query("DELETE FROM attendances WHERE user_id = $1", [uid]);
  for (const [ago, day] of [[2, 1], [1, 2]]) await db.query("INSERT INTO attendances (user_id, date, cycle_day) VALUES ($1, $2, $3)", [uid, kstDate(-ago), day]);
  const reward3 = await one("SELECT exp, coins FROM attendance_rewards WHERE day = 3");
  const reward4 = await one("SELECT exp, coins FROM attendance_rewards WHERE day = 4");

  const page = own.page;
  await page.goto(`${BASE}/town`);
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: /메뉴/ }).click();
  const panel = page.locator("[data-town-panel]");
  await panel.getByRole("button", { name: /텔레포트/ }).click();
  await panel.locator('[data-spot="board"]').click();
  await page.waitForTimeout(900);
  await page.locator("canvas").focus().catch(() => {});
  await page.keyboard.press("Space");
  await page.waitForURL(/\/feed/, { timeout: 15000 }).catch(() => {});
  check("광장 게시판 앞 Space → 마을 소식", new URL(page.url()).pathname === "/feed", page.url());

  const win = page.locator("dialog[data-attendance-window]");
  check("게시판으로 들어오면 출석 체크 창이 먼저 열림", await win.waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false));
  await page.waitForTimeout(300);
  check("새로고침해도 다시 뜨지 않게 ?board=1을 지움", !new URL(page.url()).searchParams.has("board"), page.url());
  const text = await win.innerText();
  check("창: `오늘 3일차 출석 완료 ✅`", text.includes("오늘 3일차 출석 완료 ✅"), text.slice(0, 120).replace(/\n/g, " "));
  check("창: 받은 보상 = 3일차 보상", (await win.locator("[data-attendance-got]").innerText()).includes(`✨ ${reward3.exp}`) && (await win.locator("[data-attendance-got]").innerText()).includes(`🪙 ${reward3.coins}`));
  const cells = await win.locator("[data-reward-day]").allInnerTexts();
  check("창: 1~7일차 보상표", cells.length === 7 && cells[0].includes("1일차") && cells[6].includes("7일차"), String(cells.length));
  check("창: 지난 일차 `받음`, 오늘 `오늘`, 다음 `내일`", cells[0].includes("받음") && cells[1].includes("받음") && cells[2].includes("오늘") && cells[3].includes("내일"), cells.slice(0, 4).join(" | ").replace(/\n/g, " "));
  check("창: 내일 받을 보상 안내", (await win.locator("[data-attendance-next]").innerText()).includes(`4일차 보상 ✨ ${reward4.exp} · 🪙 ${reward4.coins}`));
  const todayCell = win.locator(`[data-date="${TODAY}"]`);
  check("창: 이번 달 달력 오늘 칸 🌟 도장", (await todayCell.innerText()) === "🌟");
  const month = await one("SELECT count(*)::int AS n FROM attendances WHERE user_id = $1 AND date >= $2", [uid, `${TODAY.slice(0, 7)}-01`]);
  check("창: 달력 도장 수 = 이번 달 출석 수", (await win.locator("[data-date]").filter({ hasText: "🌟" }).count()) === month.n, `${month.n}`);
  check("창: [출석하기] 버튼 없음 (자동 출석)", (await win.getByRole("button", { name: /출석하기/ }).count()) === 0);
  await page.screenshot({ path: `${outDir}/board-attendance-1280.png` });

  await win.getByRole("button", { name: "출석 체크 창 닫기" }).click();
  check("[✕ 닫기] → 창 닫힘, 마을 소식 보임", !(await win.isVisible()) && (await page.getByRole("heading", { name: "📋 마을 소식" }).isVisible()));
  const strip = page.locator("[data-attendance-strip]");
  check("제목 아래 출석 띠 `오늘 출석 완료 ✅`", (await strip.innerText()).includes("오늘 출석 완료 ✅"));
  await strip.getByRole("button", { name: "📅 출석부 열기" }).click();
  check("[📅 출석부 열기] → 창 다시 열림", await win.isVisible());
  await page.keyboard.press("Escape");
  check("Esc → 창 닫힘", !(await win.isVisible()));
  await page.reload();
  check("새로고침하면 창은 닫힌 채", !(await page.locator("dialog[data-attendance-window]").isVisible()));
  const ledger = await one("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'attendance' AND ref_id = $2", [uid, TODAY]);
  check("출석 보상은 하루 한 줄", ledger.n === 1, String(ledger.n));

  // 휴대폰: 창이 화면 안, 가로 스크롤 없음
  const m = await fresh(phone, await own.ctx.storageState());
  await m.page.goto(`${BASE}/feed?board=1`);
  const mwin = m.page.locator("dialog[data-attendance-window]");
  check("375px 게시판 주소 → 출석 체크 창", await mwin.waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false));
  const box = await mwin.boundingBox();
  check("375px 창이 화면 너비 안", box && box.x >= 0 && box.x + box.width <= 375, box && `${Math.round(box.x)}+${Math.round(box.width)}`);
  const rewardTops = await mwin.locator("[data-reward-day]").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
  check("375px 보상표 7칸 한 줄", rewardTops === 1, String(rewardTops));
  await m.page.screenshot({ path: `${outDir}/board-attendance-375.png` });
  await m.ctx.close();

  // 방문자: 출석이 없으니 띠·창 없음
  const g = await fresh();
  await g.page.goto(`${BASE}/feed?board=1`);
  check("방문자 게시판 → 마을 소식만 (출석 띠·창 없음)", (await g.page.locator("[data-attendance-strip], dialog[data-attendance-window]").count()) === 0);
  await g.ctx.close();
}

// ══ 2. 광장 이름표: 설명 줄 없이 이름만 (Phaser 그림이라 스크린샷으로 본다) ══
{
  const page = own.page;
  await page.goto(`${BASE}/town`);
  await page.locator("canvas").waitFor();
  for (const spot of ["clothes", "shop"]) {
    await page.getByRole("button", { name: /메뉴/ }).click();
    await page.locator("[data-town-panel]").getByRole("button", { name: /텔레포트/ }).click();
    await page.locator(`[data-town-panel] [data-spot="${spot}"]`).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${outDir}/plaza-labels-${spot}-1280.png` });
  }
}

const errors = allErrors.flat();
check("콘솔 오류 없음", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("✅")).length}/${results.length} 통과`);
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
