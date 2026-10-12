// TOWN-09 동물 농장 1차: 첫 알 → 부화 → 돌보기(하루 한 번) → 다 자라면 보상, 알 사기, 5마리 제한, 글쓰기 연동
// 2026-10-11 "펫 종류, 펫 따라다니는 모션, 펫 종류별로 스킨": 동물 분양(코인), 스킨 사서 입히기, 우리 집·광장에서 스킨과 움직임
// 2026-10-12 다 키운 동물 크기 고르기 (아주 작게~크게): 농장 카드 → 방·광장
// 2026-10-12 알 확률 등급·암수·특별 진화·아기 모습으로 데리고 다니기·농장 ⓘ 안내 창
// 사용: 개발 서버를 띄운 상태에서 node e2e/farm.mjs <스크린샷 폴더> (실행마다 새 회원)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev, walkInRoom } from "./helpers.mjs";

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
const animals = async () => (await db.query("SELECT id, status, growth, species_id, sex, variant, display_form FROM user_animals WHERE user_id = $1 ORDER BY id", [uid])).rows;

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
check("부화하면 암수가 정해지고 문구에 ♀/♂", ["female", "male"].includes(hatched.sex) && /[♀♂] (암컷|수컷)/.test(await status()), `${hatched.sex} · ${await status()}`);
await page.reload();
check("키우는 동물 카드에 암수 표시", (await page.locator(`[data-animal-title="${hatched.id}"] [data-sex]`).getAttribute("data-sex")) === hatched.sex);

// ── ⓘ 안내 창: 등급별 알 확률·암수·특별 진화·아기 모습 ──
{
  const dialog = page.locator("dialog[data-farm-info]");
  check("ⓘ 안내 창은 처음에 닫혀 있다", !(await dialog.isVisible()));
  await page.locator("[data-farm-info-open]").click();
  await dialog.waitFor();
  const rarities = await dialog.locator("[data-rarity]").evaluateAll((els) => els.map((e) => e.dataset.rarity));
  check("알 확률: 보통·희귀·매우 희귀·전설 네 등급 (2026-10-12)", JSON.stringify(rarities) === JSON.stringify(["common", "rare", "epic", "legend"]), rarities.join(","));
  check("알 확률: 열아홉 종류, 병아리 10%·조랑말 3.75%·호랑이 1.25%", (await dialog.locator("[data-odds]").count()) === 19 && (await dialog.locator('[data-odds="chick"]').innerText()).includes("10%") && (await dialog.locator('[data-odds="pony"]').innerText()).includes("3.75%") && (await dialog.locator(`[data-odds="tiger"]`).innerText()).includes("1.25%"));
  const tierText = async (t) => dialog.locator(`[data-rarity="${t}"]`).innerText();
  check("등급 합: 보통 50%·희귀 30%·매우 희귀 15%·전설 5%", (await tierText("common")).includes("50%") && (await tierText("rare")).includes("30%") && (await tierText("epic")).includes("15%") && (await tierText("legend")).includes("5%") && (await tierText("legend")).includes("전설") && (await tierText("legend")).includes("사자"));
  const specialText = await dialog.locator("[data-info-special]").innerText();
  check("특별 진화 목록 25가지 (유니콘·페가수스·백호·구미호·불사조 포함)", (await dialog.locator("[data-special]").count()) === 25 && /유니콘[\s\S]*페가수스/.test(await dialog.locator("[data-info-special]").innerText()) && ["딸기우유 송아지", "백호", "구미호", "불사조", "빛나는 순록"].every((n) => specialText.includes(n)));
  check("걸음새 설명 (독수리·거북이)", (await dialog.locator("[data-info-gait]").innerText()).includes("독수리"));
  check("암수·아기 모습 설명이 있다", (await dialog.locator("[data-info-sex]").innerText()).includes("반반") && (await dialog.locator("[data-info-baby]").innerText()).includes("아기 모습"));
  await page.screenshot({ path: `${outDir}/98-farm-info.png` });
  await page.keyboard.press("Escape");
  check("Esc로 안내 창 닫기", !(await dialog.isVisible()));
}

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
// 낮은 확률(4%)로 특별 진화하면 "…(으)로 자랐어요" (2026-10-12)
await page.getByText(/다 자랐어요|자랐어요!/).waitFor();
const grownRow = (await animals())[0];
check("다 자라면 grown + 성장치는 최대에서 멈춤", grownRow.status === "grown" && grownRow.growth === sp.grow_exp, grownRow.variant ? `특별 진화 ${grownRow.variant}` : "");
// 아래 도감 검사는 종류 이름으로 찾으므로, 특별 진화했으면 시험용으로 보통 모습으로 돌린다 (특별 진화 모습은 맨 아래에서 따로 본다)
if (grownRow.variant) await db.query("UPDATE user_animals SET variant = NULL WHERE id = $1", [grownRow.id]);
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
const { id: growingId } = await one("INSERT INTO user_animals (user_id, sex, source, status, species_id, growth) VALUES ($1, 'female', 'shop', 'growing', $2, 0) RETURNING id", [uid, sp2.id]);
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
  const adoptOnly = await one("SELECT COUNT(*) FILTER (WHERE price IS NOT NULL)::int AS n, COUNT(*) FILTER (WHERE hatch_weight > 0)::int AS h, SUM(hatch_weight)::int AS w FROM animal_species");
  check("분양 동물 8종은 값이 있고, 열아홉 종류 모두 알에서 나온다 (비중 합 10,000)", adoptOnly.n === 8 && adoptOnly.h === 19 && adoptOnly.w === 10000, JSON.stringify(adoptOnly));
  await db.query("DELETE FROM user_animals WHERE user_id = $1 AND status <> 'grown'", [uid]);
  // 시험용 코인 (관리자 테스트 지급과 같은 사유)
  await db.query("INSERT INTO point_ledger (user_id, reason, coin_delta) VALUES ($1, 'admin_grant', 5000)", [uid]);
  await page.goto(`${BASE}/farm`);
  const list = page.locator("[data-adopt-list]");
  check("[🐾 동물 분양]에 8종(거북이·여우·사슴 포함, 맹수 없음), 크기·등급 표시", (await list.locator("[data-adopt]").count()) === 8 && (await list.locator('[data-adopt="pony"]').innerText()).includes("큰 동물") && (await list.locator('[data-adopt="hamster"]').innerText()).includes("작은 동물") && (await list.locator('[data-adopt="deer"]').innerText()).includes("희귀") && (await list.locator('[data-adopt="tiger"]').count()) === 0);
  const kitten = await one("SELECT id, price, grow_exp FROM animal_species WHERE code = 'kitten'");
  const k0 = await coins(page);
  await list.locator('[data-adopt="kitten"]').getByRole("button").click();
  await page.getByText(/왔어요/).waitFor();
  // 첫 알에서도 아기 고양이가 나올 수 있어(2026-10-12부터 알에서 아홉 종류) 분양한 줄만 고른다
  const adopted = await one("SELECT id, status, source, growth, sex FROM user_animals WHERE user_id = $1 AND species_id = $2 AND source = 'adopt'", [uid, kitten.id]);
  check("분양한 동물도 암수가 정해진다", ["female", "male"].includes(adopted?.sex), adopted?.sex);
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
  await walkInRoom(page);
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

  // 다 키운 동물 크기 (2026-10-12 "햄스터는 완전 작게 데리고 다니고 싶을 수 있잖아"): 농장 카드에서 고르면 방·광장에 그 크기로
  await page.goto(`${BASE}/farm`);
  const card = page.locator(`[data-grown="${adopted.id}"]`);
  check("다 키운 동물 카드에 크기 고르기 (기본 보통)", (await card.getAttribute("data-display-size")) === "normal" && (await card.locator("[data-size-choice]").count()) >= 3);
  check("키우는 중인 동물에는 크기 고르기가 없다", (await page.locator("[data-size-choice]").count()) === (await page.locator("[data-grown] [data-size-choice]").count()));
  await card.locator('[data-size-choice="tiny"]').click();
  await page.getByText(/크기를 아주 작게 바꿨어요/).waitFor();
  check("아주 작게 → DB display_size = tiny", (await one("SELECT display_size FROM user_animals WHERE id = $1", [adopted.id])).display_size === "tiny");
  const badSize = await db.query("UPDATE user_animals SET display_size = 'huge' WHERE id = $1", [adopted.id]).then(() => "ok", (e) => e.constraint ?? e.message);
  check("정해진 크기만 (CHECK)", badSize === "user_animals_display_size_check", badSize);
  await page.screenshot({ path: `${outDir}/96-farm-size.png`, fullPage: true });
  await page.goto(`${BASE}/@${devId}`);
  await pet.waitFor();
  check("우리 집 방 동물도 아주 작게 (data-display-size)", (await pet.getAttribute("data-display-size")) === "tiny");
  await page.goto(`${BASE}/town`);
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.petAt, null, { timeout: 20000 });
  check("광장에서 따라오는 동물도 아주 작게 (data-pet-display-size)", (await page.locator("canvas").getAttribute("data-pet-display-size")) === "tiny");
  await page.screenshot({ path: `${outDir}/97-town-tiny-pet.png` });
  await page.goto(`${BASE}/farm`);
  await page.locator(`[data-grown="${adopted.id}"] [data-size-choice="normal"]`).click();
  await page.getByText(/보통으로 바꿨어요/).waitFor();
  check("보통으로 되돌리기", (await one("SELECT display_size FROM user_animals WHERE id = $1", [adopted.id])).display_size === "normal");

  // 아기 모습으로 데리고 다니기 (2026-10-12 "아기 형태로 데리고 다닐 수도 있게"): 농장 카드 → 방·광장
  check("다 키운 동물 카드에 모습 고르기 (기본 다 자란 모습)", (await page.locator(`[data-grown="${adopted.id}"]`).getAttribute("data-display-form")) === "adult" && (await page.locator(`[data-grown="${adopted.id}"] [data-form-choice]`).count()) === 2);
  check("다 키운 동물 카드에 암수 표시", (await page.locator(`[data-grown="${adopted.id}"] [data-sex]`).getAttribute("data-sex")) === adopted.sex);
  await page.locator(`[data-grown="${adopted.id}"] [data-form-choice="baby"]`).click();
  await page.getByText(/아기 모습으로 데리고 다녀요/).waitFor();
  check("[🍼 아기 모습] → DB display_form = baby", (await one("SELECT display_form FROM user_animals WHERE id = $1", [adopted.id])).display_form === "baby");
  const badForm = await db.query("UPDATE user_animals SET display_form = 'teen' WHERE id = $1", [adopted.id]).then(() => "ok", (e) => e.constraint ?? e.message);
  check("정해진 모습만 (CHECK)", badForm === "user_animals_display_form_check", badForm);
  await page.reload();
  check("농장 카드도 아기 모습", (await page.locator(`[data-grown="${adopted.id}"]`).getAttribute("data-display-form")) === "baby");
  await page.screenshot({ path: `${outDir}/99-farm-baby-form.png`, fullPage: true });
  await page.goto(`${BASE}/@${devId}`);
  await pet.waitFor();
  check("우리 집 방 동물이 아기 모습 (data-display-form)", (await pet.getAttribute("data-display-form")) === "baby");
  await page.waitForTimeout(1500);
  await page.locator("[data-house-room]").screenshot({ path: `${outDir}/100-room-baby-pet.png` });
  await page.goto(`${BASE}/town`);
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.petAt, null, { timeout: 20000 });
  check("광장에서 따라오는 동물도 아기 모습 (data-pet-display-form)", (await page.locator("canvas").getAttribute("data-pet-display-form")) === "baby");
  // 조금 걸어서 따라오는 모습
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/101-town-baby-pet.png` });
  await page.goto(`${BASE}/farm`);
  await page.locator(`[data-grown="${adopted.id}"] [data-form-choice="adult"]`).click();
  await page.getByText(/다 자란 모습으로 데리고 다녀요/).waitFor();
  check("다 자란 모습으로 되돌리기", (await one("SELECT display_form FROM user_animals WHERE id = $1", [adopted.id])).display_form === "adult");

  // 특별 진화 (2026-10-12 "낮은 확률로 망아지가 유니콘이나 페가수스"): 확률은 npm run test:game이 보고, 여기서는 시험용으로 DB에 직접 넣어 보이는 모습을 본다
  const pony = await one("SELECT id, grow_exp FROM animal_species WHERE code = 'pony'");
  const noSex = await db.query("INSERT INTO user_animals (user_id, source, status, species_id) VALUES ($1, 'shop', 'growing', $2)", [uid, pony.id]).then(() => "ok", (e) => e.constraint ?? e.message);
  check("깨어난 동물은 암수가 꼭 있다 (CHECK)", noSex === "user_animals_sex_check", noSex);
  const { id: ponyId } = await one("INSERT INTO user_animals (user_id, sex, source, status, species_id, growth, hatched_at) VALUES ($1, 'male', 'adopt', 'growing', $2, 0, now()) RETURNING id", [uid, pony.id]);
  const growingVariant = await db.query("UPDATE user_animals SET variant = 'unicorn' WHERE id = $1", [ponyId]).then(() => "ok", (e) => e.constraint ?? e.message);
  check("특별 진화는 다 자란 동물만 (CHECK)", growingVariant === "user_animals_variant_check", growingVariant);
  await db.query("UPDATE user_animals SET status = 'grown', growth = $2, grown_at = now(), variant = 'unicorn' WHERE id = $1", [ponyId, pony.grow_exp]);
  await page.reload();
  const uni = page.locator(`[data-grown="${ponyId}"]`);
  check("특별 진화 카드: 유니콘 이름·✨ 배지·수컷", (await uni.getAttribute("data-variant")) === "unicorn" && (await uni.innerText()).includes("유니콘") && (await uni.innerText()).includes("특별 진화") && (await uni.locator("[data-sex]").getAttribute("data-sex")) === "male");
  check("특별한 동물은 스킨 입히기 목록에 없다", (await page.locator(`[data-skin-shop] [data-dress="${ponyId}"]`).count()) === 0);
  await uni.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${outDir}/102-farm-special.png`, fullPage: true });
  // 도감·방·광장에 유니콘 (아기 모습으로도)
  await db.query("UPDATE blogs SET showcase_animal_id = $2 WHERE owner_id = $1", [uid, ponyId]);
  await page.goto(`${BASE}/@${devId}`);
  await pet.waitFor();
  check("방 안 전시 동물: 유니콘 (이름·data-variant)", (await pet.getAttribute("title")) === "유니콘" && (await pet.getAttribute("data-variant")) === "unicorn");
  await page.locator("[data-collection-open]").click();
  const uniCard = page.locator('dialog[data-collection] [data-animal-card][data-variant="unicorn"]');
  check("도감에 유니콘이 따로 (이름·✨ 특별)", (await uniCard.innerText()).includes("유니콘") && (await uniCard.innerText()).includes("특별"));
  await page.screenshot({ path: `${outDir}/103-collection-special.png` });
  await page.keyboard.press("Escape");
  await db.query("UPDATE user_animals SET display_form = 'baby' WHERE id = $1", [ponyId]);
  await page.reload();
  await pet.waitFor();
  check("아기 모습 유니콘 (방)", (await pet.getAttribute("data-display-form")) === "baby" && (await pet.getAttribute("data-variant")) === "unicorn");
  await page.waitForTimeout(1500);
  await page.locator("[data-house-room]").screenshot({ path: `${outDir}/104-room-baby-unicorn.png` });
  await page.goto(`${BASE}/town`);
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.petAt, null, { timeout: 20000 });
  const c = page.locator("canvas");
  check("광장: 아기 유니콘이 따라온다", (await c.getAttribute("data-pet-variant")) === "unicorn" && (await c.getAttribute("data-pet-display-form")) === "baby" && (await c.getAttribute("data-pet-sex")) === "male");
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowLeft");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/105-town-baby-unicorn.png` });
}

// ── 야생 동물 (2026-10-12 "곰, 여우, 늑대, 호랑이, 사자, 독수리 …"): 새 종류가 알에서 깨어나 자라고, 특별 진화(불사조)가 날아서 따라온다 ──
{
  const pet = page.locator("[data-house-room] [data-showcase]");
  // 알에서 호랑이가 나오게 시험 동안만 비중을 크게 (끝나면 되돌린다. 확률 표 자체는 npm run test:game)
  const tiger = await one("SELECT id, hatch_weight, grow_exp, name FROM animal_species WHERE code = 'tiger'");
  await db.query("DELETE FROM user_animals WHERE user_id = $1 AND status <> 'grown'", [uid]);
  const { id: eggId } = await one("INSERT INTO user_animals (user_id, source) VALUES ($1, 'shop') RETURNING id", [uid]);
  await db.query("UPDATE animal_species SET hatch_weight = 100000000 WHERE id = $1", [tiger.id]);
  try {
    await page.goto(`${BASE}/farm`);
    await page.getByRole("button", { name: /부화시키기/ }).click();
    await page.getByText(/태어났어요/).waitFor();
  } finally {
    await db.query("UPDATE animal_species SET hatch_weight = $2 WHERE id = $1", [tiger.id, tiger.hatch_weight]);
  }
  await page.locator(`[data-animal-title="${eggId}"]`).waitFor();
  const t = await one("SELECT species_id, status, sex FROM user_animals WHERE id = $1", [eggId]);
  const msg = await page.getByText(/태어났어요/).innerText();
  check("알에서 호랑이: 👑 전설! 문구와 전설 배지", t.species_id === tiger.id && msg.includes("👑 전설!") && (await page.locator(`[data-animal-title="${eggId}"]`).locator("..").locator('[data-rarity-badge="legend"]').count()) === 1, msg);
  await page.screenshot({ path: `${outDir}/106-farm-tiger-hatched.png`, fullPage: true });
  await db.query("UPDATE user_animals SET growth = $2 WHERE id = $1", [eggId, tiger.grow_exp - 5]);
  await page.reload();
  await page.locator(`[data-animal-title="${eggId}"]`).locator("..").getByRole("button", { name: /밥 주기/ }).click();
  await page.getByText(/자랐어요!/).waitFor();
  const grownTiger = await one("SELECT status, variant FROM user_animals WHERE id = $1", [eggId]);
  check("호랑이가 다 자란다 (특별 진화면 백호)", grownTiger.status === "grown" && [null, "white_tiger"].includes(grownTiger.variant), grownTiger.variant ?? "");
  await page.locator(`[data-grown="${eggId}"]`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${outDir}/107-farm-tiger-grown.png`, fullPage: true });

  // 불사조 (독수리 특별 진화): 카드 이름, 방·광장에서 날아서 따라온다
  const eagle = await one("SELECT id, grow_exp FROM animal_species WHERE code = 'eagle'");
  const { id: phoenixId } = await one("INSERT INTO user_animals (user_id, sex, source, status, species_id, growth, hatched_at, grown_at, variant) VALUES ($1, 'female', 'shop', 'grown', $2, $3, now(), now(), 'phoenix') RETURNING id", [uid, eagle.id, eagle.grow_exp]);
  await page.reload();
  const card = page.locator(`[data-grown="${phoenixId}"]`);
  check("특별 진화 카드: 불사조 이름·✨ 배지", (await card.getAttribute("data-variant")) === "phoenix" && (await card.innerText()).includes("불사조") && (await card.innerText()).includes("특별 진화"));
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${outDir}/108-farm-phoenix.png` });
  await db.query("UPDATE blogs SET showcase_animal_id = $2 WHERE owner_id = $1", [uid, phoenixId]);
  await page.goto(`${BASE}/@${devId}`);
  await pet.waitFor();
  check("방 안 불사조: 이름·특별 진화·나는 걸음새", (await pet.getAttribute("title")) === "불사조" && (await pet.getAttribute("data-variant")) === "phoenix" && Number(await pet.getAttribute("data-gait")) > 1);
  await page.locator("[data-house-room]").screenshot({ path: `${outDir}/109-room-phoenix.png` });
  await page.goto(`${BASE}/town`);
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.petAt, null, { timeout: 20000 });
  const c = page.locator("canvas");
  check("광장: 불사조가 따라온다", (await c.getAttribute("data-pet")) === "animal.eagle" && (await c.getAttribute("data-pet-variant")) === "phoenix" && (await c.getAttribute("data-pet-size")) === "medium");
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(600);
  const flying = await c.getAttribute("data-pet-walk");
  await page.screenshot({ path: `${outDir}/110-town-phoenix-flying.png` });
  await page.keyboard.up("ArrowLeft");
  check("광장: 걸으면 날갯짓(걷기 칸)", flying === "walk", flying);
  // 거북이는 느리게 (걸음새 0.6)
  const turtle = await one("SELECT id, grow_exp FROM animal_species WHERE code = 'turtle'");
  const { id: turtleId } = await one("INSERT INTO user_animals (user_id, sex, source, status, species_id, growth, hatched_at, grown_at) VALUES ($1, 'male', 'adopt', 'grown', $2, $3, now(), now()) RETURNING id", [uid, turtle.id, turtle.grow_exp]);
  await db.query("UPDATE blogs SET showcase_animal_id = $2 WHERE owner_id = $1", [uid, turtleId]);
  await page.reload();
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.petAt, null, { timeout: 20000 });
  check("광장: 거북이는 느린 걸음새", (await c.getAttribute("data-pet")) === "animal.turtle" && Number(await c.getAttribute("data-pet-gait")) < 1);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowRight");
  await page.screenshot({ path: `${outDir}/111-town-turtle.png` });
}

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
