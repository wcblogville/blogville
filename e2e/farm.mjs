// TOWN-09 동물 농장 1차: 첫 알 → 부화 → 돌보기(하루 한 번) → 다 자라면 보상, 알 사기, 5마리 제한, 글쓰기 연동
// 사용: 개발 서버를 띄운 상태에서 node e2e/farm.mjs <스크린샷 폴더> (실행마다 새 회원)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, args) => (await db.query(q, args)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
const devId = `farm${Date.now() % 100_000_000}`;
await loginDev(page, devId);
const uid = (await one("SELECT id FROM users WHERE username = $1", [devId])).id;
const status = () => page.getByRole("status").innerText();
const animals = async () => (await db.query("SELECT id, status, growth, species_id FROM user_animals WHERE user_id = $1 ORDER BY id", [uid])).rows;

// ── 광장 농장 입구 → /farm ──
await page.goto(`${BASE}/farm`);
check("농장 화면이 열린다", await page.getByRole("heading", { name: /동물 농장/ }).isVisible());
await page.screenshot({ path: `${outDir}/90-farm-empty.png`, fullPage: true });

// ── 첫 알 → 부화 ──
await page.getByRole("button", { name: /농장 첫 알/ }).click();
await page.getByText("알을 받았어요").waitFor();
check("첫 알을 받는다", (await animals()).length === 1 && (await animals())[0].status === "egg");
// 화면 갱신이 상태 문구보다 조금 늦게 올 수 있어 사라질 때까지 기다린다
await page.getByRole("button", { name: /농장 첫 알/ }).waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
check("첫 알 버튼은 사라진다", (await page.getByRole("button", { name: /농장 첫 알/ }).count()) === 0);
await page.getByRole("button", { name: /부화시키기/ }).click();
await page.getByText(/태어났어요/).waitFor();
const [hatched] = await animals();
check("부화하면 종류가 정해지고 키우는 중이 된다", hatched.status === "growing" && hatched.species_id !== null, await status());

// ── 돌보기: 성장 +10/+10/+5, 같은 돌보기는 하루 한 번 ──
for (const label of ["밥 주기", "물 주기", "쓰다듬기"]) {
  await page.getByRole("button", { name: new RegExp(label) }).click();
  await page.getByText(new RegExp(`${label} 완료|다 자랐어요`)).waitFor();
}
check("돌보기 3가지 → 성장 25", (await animals())[0].growth === 25, `성장 ${(await animals())[0].growth}`);
// 마지막 돌보기 뒤 화면이 다시 그려질 때까지 기다린다 (바로 세면 가끔 2개)
const doneShown = await page
  .waitForFunction(() => [...document.querySelectorAll("button")].filter((b) => b.textContent.includes("완료")).length === 3, null, { timeout: 5000 })
  .then(() => true)
  .catch(() => false);
check("돌본 버튼은 '완료'로 막힌다", doneShown);
const careExp = await one("SELECT COALESCE(SUM(exp_delta),0)::int AS n, COUNT(*)::int AS c FROM point_ledger WHERE user_id = $1 AND reason = 'farm_care'", [uid]);
check("돌보기마다 경험치 +2 기록", careExp.c === 3 && careExp.n === 6, `${careExp.c}회 ${careExp.n}`);
await page.screenshot({ path: `${outDir}/91-farm-cared.png`, fullPage: true });

// ── 다 자라기: 성장치를 거의 다 채워 두고 내일 돌보기처럼 기록을 지운 뒤 밥 주기 ──
const sp = await one("SELECT name, grow_exp, reward_exp, reward_coins FROM animal_species WHERE id = $1", [hatched.species_id]);
await db.query("UPDATE user_animals SET growth = $2 WHERE id = $1", [hatched.id, sp.grow_exp - 5]);
await db.query("DELETE FROM animal_cares WHERE animal_id = $1", [hatched.id]);
await page.reload();
const coinsBeforeGrown = await coins(page);
await page.getByRole("button", { name: /밥 주기/ }).click();
await page.getByText(/다 자랐어요/).waitFor();
const grownRow = (await animals())[0];
check("다 자라면 grown + 성장치는 최대에서 멈춤", grownRow.status === "grown" && grownRow.growth === sp.grow_exp);
const grownLedger = await one("SELECT exp_delta, coin_delta FROM point_ledger WHERE user_id = $1 AND reason = 'farm_grown'", [uid]);
check(`다 키운 보상 = 종류 표 숫자 (${sp.name})`, grownLedger?.exp_delta === sp.reward_exp && grownLedger?.coin_delta === sp.reward_coins);
await page.reload();
check("헤더 코인에 보상 반영", (await coins(page)) - coinsBeforeGrown === sp.reward_coins, `${coinsBeforeGrown} → ${await coins(page)}`);
check("다 키운 동물 카드가 보인다", await page.locator("section", { hasText: "다 키운 동물" }).getByText(sp.name).isVisible());
await page.screenshot({ path: `${outDir}/92-farm-grown.png`, fullPage: true });

// ── 알 사기 (코인 100) ──
const c0 = await coins(page);
await page.getByRole("button", { name: /알 사기/ }).click();
await page.getByText("알을 샀어요").waitFor();
await page.reload();
check("알 사기 → 코인 −100", c0 - (await coins(page)) === 100, `${c0} → ${await coins(page)}`);

// ── 5마리 제한 ──
await db.query("INSERT INTO user_animals (user_id, source) SELECT $1, 'shop' FROM generate_series(1, 4)", [uid]);
await page.reload();
check("5마리면 알 버튼이 막힌다", await page.getByRole("button", { name: /알 사기/ }).isDisabled());

// ── 글쓰기 보상 → 키우는 동물마다 성장 +10 ──
await db.query("DELETE FROM user_animals WHERE user_id = $1 AND status = 'egg'", [uid]);
const sp2 = await one("SELECT id FROM animal_species WHERE code = 'calf'");
const { id: growingId } = await one("INSERT INTO user_animals (user_id, source, status, species_id, growth) VALUES ($1, 'shop', 'growing', $2, 0) RETURNING id", [uid, sp2.id]);
await page.goto(`${BASE}/write`);
await page.locator(".ProseMirror").waitFor();
await page.getByPlaceholder("제목").fill("농장 동물에게 들려주는 글");
await page.locator(".ProseMirror").click();
await page.keyboard.type("오늘은 동물 농장을 만들었다. ".repeat(8));
await page.getByRole("button", { name: "발행하기" }).click();
// 발행 보상은 안내 문구로 확인한다 (post: 보상 여부를 주소에 담지 않음, POST-01 / FR-013)
await page.getByText("코인을 받았어요").waitFor();
check("공개 글 보상 → 동물 성장 +10", (await one("SELECT growth FROM user_animals WHERE id = $1", [growingId])).growth === 10);

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
