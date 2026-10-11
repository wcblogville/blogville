// TOWN-09 동물 농장 1차: 첫 알 → 부화 → 돌보기(하루 한 번) → 다 자라면 보상, 알 사기, 5마리 제한, 글쓰기 연동
// 2026-10-11 "펫 종류, 펫 따라다니는 모션, 펫 종류별로 스킨": 동물 분양(코인), 스킨 사서 입히기, 우리 집·광장에서 스킨과 움직임
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

// ── 블로그 우리 집 방의 [🏅 도감] → 도감 창, 전시하기·전시 빼기 (사용자 요청 2026-10-09, 2026-10-11 프로필 카드 → 방) ──
{
  await page.goto(`${BASE}/@${devId}`);
  const openBtn = page.locator("[data-collection-open]");
  const dialog = page.locator("dialog[data-collection]");
  const room = page.locator("[data-house-room]");
  check("우리 집 방 도구 줄에 [🏅 도감 1] 버튼", (await room.locator("[data-collection-open]").innerText()).replace(/\s+/g, " ").trim() === "🏅 도감 1", await openBtn.innerText());
  check("처음엔 방 안에 주인 캐릭터만 (전시 동물 없음)", (await room.locator("[data-room-resident]").count()) === 1 && (await room.locator("[data-showcase]").count()) === 0);
  check("도감 창은 처음에 닫혀 있다", !(await dialog.isVisible()));
  await openBtn.click();
  await dialog.waitFor();
  const card = dialog.locator("[data-animal-card]", { hasText: sp.name });
  check("[🏅 도감] → 창에 다 키운 동물 카드", (await dialog.locator("[data-animal-card]").count()) === 1 && (await card.isVisible()));
  await card.getByRole("button", { name: "전시하기" }).click();
  await card.getByText("전시 중").waitFor({ timeout: 10000 });
  const shown = await one("SELECT showcase_animal_id AS id FROM blogs WHERE owner_id = $1", [uid]);
  check("창에서 [전시하기] → 전시 동물 저장, 창은 열린 채", shown.id === grownRow.id && (await dialog.isVisible()));
  await page.screenshot({ path: `${outDir}/93-collection-dialog.png` });
  await dialog.getByRole("button", { name: "도감 닫기" }).click();
  check("✕로 창 닫기", !(await dialog.isVisible()));
  check("방 안에 그 동물이 주인과 함께", (await room.locator("[data-showcase]").getAttribute("title")) === sp.name);
  await openBtn.click();
  await card.getByRole("button", { name: "전시 빼기" }).click();
  await page.locator("[data-showcase]").waitFor({ state: "detached", timeout: 10000 });
  const cleared = await one("SELECT showcase_animal_id AS id FROM blogs WHERE owner_id = $1", [uid]);
  await page.keyboard.press("Escape");
  check("[전시 빼기] → 방 안에 동물 없음, Esc로 창 닫기", cleared.id === null && !(await dialog.isVisible()) && (await room.locator("[data-showcase]").count()) === 0);
  await page.goto(`${BASE}/farm`);
}

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

// ── 동물 분양·스킨 (사용자 요청 2026-10-11 "펫 종류, 펫 따라다니는 모션, 펫 종류별로 스킨") ──
{
  const adoptOnly = await one("SELECT COUNT(*)::int AS n FROM animal_species WHERE hatch_weight = 0 AND price IS NOT NULL");
  check("분양 동물 5종은 알에서 안 나오고 값이 있다", adoptOnly.n === 5, adoptOnly.n);
  await db.query("DELETE FROM user_animals WHERE user_id = $1 AND status <> 'grown'", [uid]);
  // 시험용 코인 (관리자 테스트 지급과 같은 사유)
  await db.query("INSERT INTO point_ledger (user_id, reason, coin_delta) VALUES ($1, 'admin_grant', 5000)", [uid]);
  await page.goto(`${BASE}/farm`);
  const list = page.locator("[data-adopt-list]");
  check("[🐾 동물 분양]에 5종, 크기 표시", (await list.locator("[data-adopt]").count()) === 5 && (await list.locator('[data-adopt="pony"]').innerText()).includes("큰 동물") && (await list.locator('[data-adopt="hamster"]').innerText()).includes("작은 동물"));
  const kitten = await one("SELECT id, price, grow_exp FROM animal_species WHERE code = 'kitten'");
  const k0 = await coins(page);
  await list.locator('[data-adopt="kitten"]').getByRole("button").click();
  await page.getByText(/왔어요/).waitFor();
  const adopted = await one("SELECT id, status, source, growth FROM user_animals WHERE user_id = $1 AND species_id = $2", [uid, kitten.id]);
  const adoptLedger = await one("SELECT coin_delta FROM point_ledger WHERE user_id = $1 AND reason = 'animal_adopt'", [uid]);
  check("아기 고양이 분양 → 알 없이 키우는 중, 코인 −값", adopted?.status === "growing" && adopted.source === "adopt" && adoptLedger?.coin_delta === -kitten.price);
  await page.reload();
  check("헤더 코인에 분양 값 반영", k0 - (await coins(page)) === kitten.price, `${k0} → ${await coins(page)}`);

  // 스킨: 동물을 고르고 삼색이를 사서 입힌다 → 기본으로 → 다시 입히면 공짜
  const calico = await one("SELECT id, price, asset_key FROM animal_skins WHERE code = 'kitten_calico'");
  const shop = page.locator("[data-skin-shop]");
  await shop.locator(`[data-dress="${adopted.id}"]`).click();
  check("고른 동물 종류의 스킨만 (기본 + 2)", (await shop.locator(`[data-skins="${adopted.id}"] [data-skin]`).count()) === 3);
  await shop.locator(`[data-skin="${calico.asset_key}"]`).getByRole("button").click();
  await page.getByText(/사서 입혔어요/).waitFor();
  const worn = await one("SELECT skin_id FROM user_animals WHERE id = $1", [adopted.id]);
  const skinLedger = await one("SELECT COUNT(*)::int AS c, SUM(coin_delta)::int AS s FROM point_ledger WHERE user_id = $1 AND reason = 'skin_purchase'", [uid]);
  check("스킨 사서 입히기 → skin_id·산 스킨·코인 −값", worn.skin_id === calico.id && skinLedger.c === 1 && skinLedger.s === -calico.price);
  await shop.locator('[data-skin="base"]').getByRole("button", { name: "입히기" }).click();
  await page.getByText(/기본 색/).waitFor();
  check("기본으로 되돌리기", (await one("SELECT skin_id FROM user_animals WHERE id = $1", [adopted.id])).skin_id === null);
  await shop.locator(`[data-skin="${calico.asset_key}"]`).getByRole("button", { name: "입히기" }).click();
  await page.getByText(/스킨을 입혔어요/).waitFor();
  const again = await one("SELECT COUNT(*)::int AS c FROM point_ledger WHERE user_id = $1 AND reason = 'skin_purchase'", [uid]);
  check("산 스킨은 다시 입혀도 공짜", again.c === 1 && (await one("SELECT skin_id FROM user_animals WHERE id = $1", [adopted.id])).skin_id === calico.id);
  const other = await one("SELECT id FROM animal_skins WHERE code = 'pony_zebra'");
  const bad = await db.query("UPDATE user_animals SET skin_id = $2 WHERE id = $1", [adopted.id, other.id]).then(() => "ok", (e) => e.constraint ?? e.message);
  check("다른 종류의 스킨은 DB가 막는다 (복합 FK)", bad === "user_animals_skin_species_fk", bad);
  await page.reload();
  await page.screenshot({ path: `${outDir}/94-farm-adopt-skin.png`, fullPage: true });

  // 다 키워 전시 → 우리 집 방: 스킨·크기·움직임(걷기·숨쉬기 그림, 보는 쪽)
  await db.query("UPDATE user_animals SET status = 'grown', growth = $2, grown_at = now() WHERE id = $1", [adopted.id, kitten.grow_exp]);
  await db.query("UPDATE blogs SET showcase_animal_id = $2 WHERE owner_id = $1", [uid, adopted.id]);
  await page.goto(`${BASE}/@${devId}`);
  const pet = page.locator("[data-house-room] [data-showcase]");
  await pet.waitFor();
  check("방 안 전시 동물에 스킨·크기", (await pet.getAttribute("data-skin")) === calico.asset_key && (await pet.getAttribute("data-size")) === "small");
  const walked = await page
    .waitForFunction(() => document.querySelector("[data-showcase]")?.dataset.walk?.startsWith("walk-"), null, { timeout: 15000 })
    .then(() => true, () => false);
  check("주인을 따라 걸을 때 걷기 그림 (data-walk=walk-…)", walked, await pet.getAttribute("data-walk"));
  const positions = new Set();
  for (let i = 0; i < 12; i++) {
    positions.add(await pet.evaluate((el) => el.style.backgroundPosition));
    await page.waitForTimeout(70);
  }
  check("걷는 동안 그림 칸이 바뀐다 (그림판 칸 2개 이상)", positions.size >= 2, [...positions].join(" | "));
  await page.screenshot({ path: `${outDir}/95-room-skin-pet.png` });
}

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
