// 출석 1·2·3등 보너스 (GAME-04): 그날(한국 시간) 먼저 출석한 3명은 🪙 100을 더 받는다
// 사용: 개발 서버를 띄운 상태에서 node e2e/attendance-rank.mjs <스크린샷 폴더>
// 실행마다 새 회원 4명을 만들어 차례로 출석한다. 오늘 이미 출석한 사람 수에 맞춰 기대값을 계산한다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const todayCount = async () =>
  (await db.query("SELECT count(*)::int AS n FROM attendances WHERE date = (now() AT TIME ZONE 'Asia/Seoul')::date")).rows[0].n;
const rankBonusCount = async (username) =>
  (
    await db.query(
      "SELECT count(*)::int AS n FROM point_ledger l JOIN users u ON u.id = l.user_id WHERE u.username = $1 AND l.reason = 'attendance_rank' AND l.coin_delta = 100",
      [username],
    )
  ).rows[0].n;

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const run = Date.now() % 100_000_000;

for (let i = 1; i <= 4; i++) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = collectErrors(page);
  const username = `att${run}${i}`;
  await loginDev(page, username);
  const before = await todayCount();
  const wantRank = before + 1;
  const wantBonus = wantRank <= 3;

  await page.goto(`${BASE}/attendance`);
  await page.getByRole("button", { name: /출석하고 보상 받기/ }).click();
  await page.getByText(/출석 완료!/).waitFor();
  const rankText = await page.getByText(/오늘 \d등으로 출석했어요/).innerText().catch(() => "");
  const coinsText = await page.getByText(/✨ 경험치/).innerText();
  if (wantBonus) await page.screenshot({ path: `${outDir}/90-attendance-rank${wantRank}.png` });

  check(
    `${wantRank}번째 출석: 화면 ${wantBonus ? `'${wantRank}등' 표시` : "등수 표시 없음"}`,
    wantBonus ? rankText.includes(`오늘 ${wantRank}등`) : rankText === "",
    rankText || "표시 없음",
  );
  check(`${wantRank}번째 출석: 받은 코인 ${wantBonus ? 120 : 20}`, coinsText.includes(`🪙 ${wantBonus ? 120 : 20}`), coinsText.replace(/\s+/g, " "));
  check(`${wantRank}번째 출석: 원장 1~3등 보너스 ${wantBonus ? 1 : 0}건`, (await rankBonusCount(username)) === (wantBonus ? 1 : 0));

  // 같은 날 다시 눌러도 보너스는 늘지 않는다
  await page.goto(`${BASE}/attendance`);
  check(`${wantRank}번째 출석: 다시 들어가면 '이미 출석'`, await page.getByText("오늘은 이미 출석했어요").isVisible());
  check(`${wantRank}번째 출석: 오류 없음`, errors.length === 0, errors.join(" / "));
  await page.close();
}

// 하루에 보너스를 받은 사람은 3명을 넘지 않는다
const { rows } = await db.query(
  "SELECT count(*)::int AS n FROM point_ledger WHERE reason = 'attendance_rank' AND ref_id = (now() AT TIME ZONE 'Asia/Seoul')::date::text",
);
check("오늘 1~3등 보너스는 3명 이하", rows[0].n <= 3, `${rows[0].n}명`);

console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
