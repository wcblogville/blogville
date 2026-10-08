// 자동 출석 (GAME-04 / US3, SC-003·004·005·008, quickstart US3)
// 사용: 개발 서버를 띄운 상태에서 node e2e/attendance.mjs <스크린샷 폴더>
// 실행마다 새 회원을 만들고, 날짜는 pg로 어제·그저께 출석을 넣어 준비한다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const kstDate = (offsetDays) => new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
const TODAY = kstDate(0);
const REWARDS = { 1: [10, 10], 2: [10, 20], 3: [15, 30], 4: [15, 40], 5: [20, 50], 6: [20, 70], 7: [30, 100] };

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const n = Date.now() % 100_000_000;
const NAME = `att${n}`;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, NAME, "남자 주민");
const uid = (await one("SELECT id FROM users WHERE username = $1", [NAME])).id;

const todayRow = () => one("SELECT cycle_day, session_id, checked_at FROM attendances WHERE user_id = $1 AND date = $2", [uid, TODAY]);
const todayLedger = () =>
  db.query("SELECT exp_delta, coin_delta, ref_id FROM point_ledger WHERE user_id = $1 AND reason = 'attendance' AND ref_id = $2", [uid, TODAY]).then((r) => r.rows);
async function resetDays(days) {
  // 오늘 출석과 그 보상을 지우고, days = [[며칠 전, 일차], ...]를 넣는다
  await db.query("DELETE FROM point_ledger WHERE user_id = $1 AND reason = 'attendance' AND ref_id = $2", [uid, TODAY]);
  await db.query("DELETE FROM attendances WHERE user_id = $1", [uid]);
  for (const [ago, day] of days) await db.query("INSERT INTO attendances (user_id, date, cycle_day) VALUES ($1, $2, $3)", [uid, kstDate(-ago), day]);
}

// ══ US3-1 가입 직후(출석 기록 없음) 첫 화면 → 1일차 ══
{
  const row = await todayRow();
  const led = await todayLedger();
  check("US3-1 첫 화면에서 1일차 자동 출석", row?.cycle_day === 1, JSON.stringify(row));
  check("US3-1 원장 attendance ✨10·🪙10 한 줄, ref_id = 오늘", JSON.stringify(led) === JSON.stringify([{ exp_delta: 10, coin_delta: 10, ref_id: TODAY }]), JSON.stringify(led));
  check("FR-025 session_id·checked_at 채워짐", Boolean(row?.session_id) && Boolean(row?.checked_at));
  check("US3-1 헤더 🪙 110 (가입 100 + 출석 10)", (await coins(page)) === 110, String(await coins(page)));
}

// ══ US3-2~5 일차 계산 (어제 1~6 → +1, 어제 7 → 1, 그저께 → 1) ══
for (const [label, days, want] of [
  ["어제 1일차 → 2일차", [[1, 1]], 2],
  ["어제 3일차 → 4일차", [[2, 2], [1, 3]], 4],
  ["어제 6일차 → 7일차", [[1, 6]], 7],
  ["어제 7일차 → 1일차", [[1, 7]], 1],
  ["그저께가 마지막 → 1일차", [[2, 5]], 1],
]) {
  await resetDays(days);
  await page.goto(`${BASE}/wallet`);
  const row = await todayRow();
  const led = await todayLedger();
  const [exp, coin] = REWARDS[want];
  check(`US3 ${label}`, row?.cycle_day === want, JSON.stringify(row?.cycle_day));
  check(`US3 ${want}일차 보상 ✨${exp}·🪙${coin} (보상표와 같음)`, led.length === 1 && led[0].exp_delta === exp && led[0].coin_delta === coin, JSON.stringify(led));
  check(`US3 ${want}일차 헤더 코인 = 가입 100 + ${coin}`, (await coins(page)) === 100 + coin, String(await coins(page)));
}

// 같은 날 다시 → 아무것도 바뀌지 않음
await page.goto(`${BASE}/feed`);
check("US3 같은 날 다른 화면 → 출석·원장 그대로", (await todayLedger()).length === 1);

// ══ US3-8·10 출석 화면 (4일차 모양) ══
await resetDays([[3, 1], [2, 2], [1, 3]]);
await page.goto(`${BASE}/attendance`);
const main = page.locator("main");
const mainText = await main.innerText();
check("US3-8 [출석하기] 버튼 없음", (await main.getByRole("button", { name: /출석/ }).count()) === 0);
check("US3-8 `🎁 출석 완료! 4일차`", mainText.includes("🎁 출석 완료! 4일차"));
check("US3-8 `오늘 4일차 출석 완료`", mainText.includes("오늘 4일차 출석 완료"));
const cells = await main.getByRole("listitem").allInnerTexts();
check("FR-020 7칸 보상표", cells.length === 7 && cells[0].includes("1일차") && cells[6].includes("✨ 30") && cells[6].includes("🪙 100"), cells.join(" | ").replace(/\n/g, " "));
check("FR-026 오늘 일차 칸 강조", ((await main.locator('li[aria-current="true"]').innerText()) ?? "").includes("4일차"));
const month = await db.query("SELECT count(*)::int AS n FROM attendances WHERE user_id = $1 AND date >= $2", [uid, `${TODAY.slice(0, 7)}-01`]);
check("FR-027 `이번 달 N일 출석 · 현재 4일차`", mainText.includes(`이번 달 ${month.rows[0].n}일 출석 · 현재 4일차`), mainText.match(/이번 달[^\n]*/)?.[0]);
const todayCell = main.locator(`[data-date="${TODAY}"]`);
check("US3-10 오늘 칸 🌟 + 노란 테두리", (await todayCell.innerText()) === "🌟" && (await todayCell.getAttribute("class")).includes("border-sun"));
check("US3-10 달력은 이번 달만", (await main.locator("[data-date]").evaluateAll((els) => els.every((e) => e.dataset.date.startsWith(document.querySelector("[data-date]").dataset.date.slice(0, 7))))));
const oldTexts = ["출석하고 보상 받기", "편지 여는 중", "일 연속", "연속 보너스", "이미 출석했어요", "현재 연속", "연속 출석이 끊겼어요", "아직 출석 기록이 없어요"];
check("FR-030 옛 문구 없음", oldTexts.every((t) => !mainText.includes(t)), oldTexts.filter((t) => mainText.includes(t)).join(","));
await page.screenshot({ path: `${outDir}/attendance-day4.png`, fullPage: true });

// 375px: 가로 스크롤 없음, 7칸 한 줄
{
  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/attendance`);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("SC-008 375px 가로 스크롤 없음", overflow <= 0, String(overflow));
  const tops = await mp.locator("main li").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
  check("SC-008 375px 보상표 7칸 한 줄", tops === 1, String(tops));
  await mp.screenshot({ path: `${outDir}/attendance-375.png`, fullPage: true });
  await m.close();
}

// ══ US3-6 같은 회원 10개 탭 동시 첫 화면 → 출석 1행, 원장 1줄 (SC-003) ══
await resetDays([[1, 2]]);
const tabs = await Promise.all(Array.from({ length: 10 }, () => ctx.newPage()));
await Promise.all(tabs.map((t) => t.goto(`${BASE}/wallet`)));
const rows = await one("SELECT count(*)::int AS n, max(cycle_day) AS d FROM attendances WHERE user_id = $1 AND date = $2", [uid, TODAY]);
check("SC-003 10개 탭 동시 → 출석 1행(3일차)", rows.n === 1 && rows.d === 3, JSON.stringify(rows));
check("SC-003 10개 탭 동시 → 원장 attendance 1줄", (await todayLedger()).length === 1);
await Promise.all(tabs.map((t) => t.close()));

// ══ US3-7 보상 기록이 실패하면 출석도 없음, 화면은 그대로 (FR-024) ══
await resetDays([[1, 1]]);
await db.query("INSERT INTO point_ledger (user_id, reason, exp_delta, coin_delta, ref_id) VALUES ($1, 'attendance', 1, 0, $2)", [uid, TODAY]);
const res = await page.goto(`${BASE}/wallet`);
check("US3-7 보상 실패 → 일반 화면은 열림", res?.status() === 200, String(res?.status()));
check("US3-7 보상 실패 → 출석 행도 없음", !(await todayRow()));
const attRes = await page.goto(`${BASE}/attendance`);
check("US3-7 보상 실패 → 출석 화면은 오류 화면", (await page.locator("main").innerText()).includes("문제") || (attRes?.status() ?? 200) >= 500, String(attRes?.status()));
await db.query("DELETE FROM point_ledger WHERE user_id = $1 AND reason = 'attendance' AND ref_id = $2", [uid, TODAY]);
await page.goto(`${BASE}/wallet`);
check("US3-7 다음 화면에서 다시 시도 → 2일차", (await todayRow())?.cycle_day === 2);

// ══ 로그인 상태가 끝남 → 출석은 남고 session_id만 NULL ══
const sid = (await todayRow()).session_id;
await db.query("DELETE FROM sessions WHERE id = $1", [sid]);
const after = await todayRow();
check("세션 삭제 → 출석 남고 session_id NULL", after && after.session_id === null, JSON.stringify(after));

// ══ US3-12 방문자 ══
{
  const v = await browser.newContext();
  const vp = await v.newPage();
  await vp.goto(`${BASE}/attendance`);
  check("US3-12 방문자 /attendance → /", new URL(vp.url()).pathname === "/", vp.url());
  await v.close();
}

// 없어진 출석 Action: 아무 Action ID로 보내도 출석이 생기지 않는다
{
  const before = await one("SELECT count(*)::int AS n FROM attendances WHERE user_id = $1", [uid]);
  await page.request.post(`${BASE}/attendance`, { headers: { "Next-Action": "0".repeat(42), "Content-Type": "text/plain;charset=UTF-8" }, data: "[]" }).catch(() => null);
  const afterN = await one("SELECT count(*)::int AS n FROM attendances WHERE user_id = $1", [uid]);
  check("옛 attend Action 요청 → 출석 변화 없음", before.n === afterN.n);
}

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
