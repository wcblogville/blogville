// 동물 도감 (사용자 요청 2026-10-16 "한 마리도 부화시키기 전에는 모든 동물을(특수진화 포함) 그림자 형태 카드로, 얻으면 열리게, 다 해금하면 용"):
// 처음엔 44칸 모두 그림자 → 동물을 얻으면 그 칸이 열린다 → 마지막 칸을 열면 용이 다 자란 모습으로 온다 (한 번만)
// 사용: 개발 서버를 띄운 상태에서 node e2e/dex.mjs <스크린샷 폴더>
// 요구사항: BLOG-04 동물 도감, TOWN-09 동물 농장
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
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
const errors = collectErrors(page);
const devId = `dx${Date.now() % 100_000_000}`;
await loginDev(page, devId);
const uid = (await one("SELECT id FROM users WHERE username = $1", [devId])).id;
const dialog = page.locator("dialog[data-collection]");
const openDex = async () => {
  await page.goto(`${BASE}/@${devId}`);
  await page.locator("[data-collection-open]").click();
  await dialog.waitFor();
};

// 1) 처음: 모든 칸이 그림자
await openDex();
const cards = dialog.locator("[data-dex-card]");
check("처음 도감 0/44, 버튼에도 0/44", (await dialog.locator("[data-dex-count]").innerText()).replace(/\s/g, "") === "0/44" && (await page.locator("[data-collection-open]").innerText()).includes("0/44"));
check("44칸 모두 잠김 (??? + 그림자)", (await cards.count()) === 44 && (await dialog.locator('[data-dex-card][data-unlocked="false"]').count()) === 44 && (await cards.first().innerText()).includes("???"));
check("그림자: 그림이 까맣게", (await cards.first().locator("img").evaluate((el) => getComputedStyle(el).filter)).includes("brightness(0)"));
check("특별 진화 칸은 어느 동물의 진화인지만", (await dialog.locator('[data-dex-card="unicorn"]').innerText()).includes("조랑말의 진화") && !(await dialog.locator('[data-dex-card="unicorn"]').innerText()).includes("유니콘"));
check("용 칸은 잠김", (await dialog.locator("[data-dex-reward]").getAttribute("data-dex-reward")) === "locked");
await dialog.screenshot({ path: `${outDir}/dex-empty.png` });

// 2) 동물을 얻으면 그 칸이 열린다: 햄스터만 빼고 18종 + 특별 진화 24가지를 다 키운 것으로 넣는다 (특별 진화도 그 종류 칸을 연다)
const species = (await db.query("SELECT id, code, grow_exp FROM animal_species WHERE NOT reward_only")).rows;
const byCode = new Map(species.map((s) => [s.code, s]));
const variants = [
  ["golden_hen", "chick"], ["dutch_bunny", "bunny"], ["panda_hamster", "hamster"], ["black_pig", "piglet"], ["galaxy_cat", "kitten"],
  ["angel_puppy", "puppy"], ["rainbow_lamb", "lamb"], ["strawberry_calf", "calf"], ["unicorn", "pony"], ["pegasus", "pony"],
  ["panda_bear", "bear"], ["polar_bear", "bear"], ["silver_fox", "fox"], ["nine_tailed", "fox"], ["snow_wolf", "wolf"],
  ["white_tiger", "tiger"], ["white_lion", "lion"], ["golden_eagle", "eagle"], ["phoenix", "eagle"], ["golden_turtle", "turtle"],
  ["king_cheetah", "cheetah"], ["black_panther", "leopard"], ["snow_leopard", "leopard"], ["silver_deer", "deer"], ["glowing_reindeer", "deer"],
];
const grownRow = (code, variant = null) =>
  db.query(
    "INSERT INTO user_animals (user_id, species_id, status, growth, source, sex, variant, hatched_at, grown_at) VALUES ($1, $2, 'grown', $3, 'shop', 'female', $4, now(), now())",
    [uid, byCode.get(code).id, byCode.get(code).grow_exp, variant],
  );
check("도감 칸 목록 = 시험의 특별 진화 25가지 + 19종", variants.length === 25 && species.length === 19);
for (const sp of species) if (sp.code !== "hamster") await grownRow(sp.code);
for (const [key, code] of variants) if (code !== "hamster") await grownRow(code, key);
await openDex();
check("얻은 칸이 열린다 (18종 + 특별 진화 24 = 42/44)", (await dialog.locator("[data-dex-count]").innerText()).replace(/\s/g, "") === "42/44");
const unicorn = dialog.locator('[data-dex-card="unicorn"]');
check("열린 칸은 이름과 그림 (그림자 아님)", (await unicorn.innerText()).includes("유니콘") && (await unicorn.getAttribute("data-unlocked")) === "true" && !(await unicorn.locator("img").evaluate((el) => getComputedStyle(el).filter)).includes("brightness"));
check("햄스터·판다 햄스터 칸은 아직 잠김", (await dialog.locator('[data-dex-card="hamster"]').getAttribute("data-unlocked")) === "false" && (await dialog.locator('[data-dex-card="panda_hamster"]').getAttribute("data-unlocked")) === "false");
await dialog.screenshot({ path: `${outDir}/dex-partial.png` });

// 3) 마지막 칸: 판다 햄스터로 다 자라는 순간 = 44/44 → 용. (특별 진화 뽑기는 서버라, 다 자란 판다 햄스터를 넣어 두고 다른 동물이 다 자라게 한다.
//    보상은 동물이 다 자랄 때 도감을 본다)
await grownRow("hamster", "panda_hamster");
await openDex();
check("44/44, 용은 아직 안 옴 (다 자라는 순간에만 준다)", (await dialog.locator("[data-dex-count]").innerText()).replace(/\s/g, "") === "44/44" && (await dialog.locator("[data-dex-reward]").getAttribute("data-dex-reward")) === "locked");
const dragons = async () => (await one("SELECT COUNT(*)::int AS n FROM user_animals ua JOIN animal_species s ON s.id = ua.species_id WHERE ua.user_id = $1 AND s.code = 'dragon'", [uid])).n;
const nearlyGrown = async () => {
  const chick = byCode.get("chick");
  await db.query("INSERT INTO user_animals (user_id, species_id, status, growth, source, sex, hatched_at) VALUES ($1, $2, 'growing', $3, 'shop', 'male', now())", [uid, chick.id, chick.grow_exp - 5]);
  await page.goto(`${BASE}/farm`);
  // 앞에서 다 자라 레벨이 올랐으면 레벨업 창이 먼저 뜬다 (collectErrors의 처리기가 닫는다). 뜰 틈을 주고 누른다
  await page.locator('dialog[open][aria-labelledby="level-up-title"]').waitFor({ timeout: 2000 }).catch(() => {});
  await page.getByRole("button", { name: /밥 주기/ }).first().click();
  await page.getByText(/자랐어요/).waitFor();
};
await nearlyGrown();
check("동물이 다 자라자 '도감을 다 채웠어요! 전설의 용이 찾아왔어요'", await page.getByText(/도감을 다 채웠어요! 전설의 용이 찾아왔어요/).isVisible());
const dragon = await one("SELECT ua.status, ua.source, ua.sex, ua.grown_at FROM user_animals ua JOIN animal_species s ON s.id = ua.species_id WHERE ua.user_id = $1 AND s.code = 'dragon'", [uid]);
check("용은 다 자란 모습으로 (source reward, 암수 있음)", dragon?.status === "grown" && dragon.source === "reward" && ["female", "male"].includes(dragon.sex) && dragon.grown_at !== null, JSON.stringify(dragon));
await page.screenshot({ path: `${outDir}/dex-dragon-farm.png`, fullPage: true });
await nearlyGrown();
check("용은 한 번만", (await dragons()) === 1);

// 4) 도감 창: 용 칸이 열리고, 우리 집 동물로 전시할 수 있다
await openDex();
check("도감 창에 용을 받았다고", (await dialog.locator("[data-dex-reward]").getAttribute("data-dex-reward")) === "received" && (await dialog.locator("[data-dex-reward]").innerText()).includes("전설의 용이 함께해요"));
check("용은 도감 칸 수에 들지 않는다 (44/44 그대로)", (await dialog.locator("[data-dex-count]").innerText()).replace(/\s/g, "") === "44/44");
await dialog.screenshot({ path: `${outDir}/dex-full.png` });
const dragonCard = dialog.locator("[data-animal-card]", { hasText: "용" }).first();
await dragonCard.getByRole("button", { name: "전시하기" }).click();
await dragonCard.getByText("전시 중").waitFor({ timeout: 10000 });
await page.keyboard.press("Escape");
await page.locator("[data-house-room] [data-showcase]").waitFor();
check("용을 전시하면 우리 집 방에 용", (await page.locator("[data-house-room] [data-showcase]").getAttribute("title")) === "용");
await page.locator("[data-house-room]").screenshot({ path: `${outDir}/dex-dragon-room.png` });

// 5) 농장 (2026-10-16 요청): [알 확률표] 버튼, 창을 내려도 닫기 버튼이 위에, 다 키운 카드에서 [데리고 다니기]
await page.goto(`${BASE}/farm`);
await page.locator('dialog[open][aria-labelledby="level-up-title"]').waitFor({ timeout: 2000 }).catch(() => {});
const infoBtn = page.locator("[data-farm-info-open]");
check("농장 안내 버튼에 '알 확률표' 글자", (await infoBtn.innerText()).includes("알 확률표"));
await infoBtn.click();
const info = page.locator("dialog[data-farm-info]");
await info.waitFor();
await info.evaluate((el) => el.scrollTo(0, el.scrollHeight));
await page.waitForTimeout(300);
const closeBox = await info.getByRole("button", { name: "안내 닫기" }).boundingBox();
const infoBox = await info.boundingBox();
check("확률표 창을 끝까지 내려도 닫기 버튼이 창 위에 보인다", closeBox && infoBox && closeBox.y >= infoBox.y - 1 && closeBox.y < infoBox.y + 60, `${closeBox?.y} / ${infoBox?.y}`);
await page.screenshot({ path: `${outDir}/dex-farm-info-scrolled.png` });
await info.getByRole("button", { name: "안내 닫기" }).click();
const dragonFarmCard = page.locator(`[data-grown]`, { hasText: "용" }).first();
check("농장: 전시한 용 카드에 '따라다니는 중'", (await dragonFarmCard.locator('[data-follow="on"]').count()) === 1);
const chickCard = page.locator(`[data-grown]`, { hasText: "병아리" }).first();
const chickId = Number(await chickCard.getAttribute("data-grown"));
await chickCard.locator('[data-follow="off"]').click();
await page.getByText(/나를 따라다녀요/).waitFor();
check("농장 [데리고 다니기] → 전시 동물이 바뀐다", (await one("SELECT showcase_animal_id AS id FROM blogs WHERE owner_id = $1", [uid])).id === chickId);
await chickCard.getByRole("button", { name: "그만 따라오기" }).click();
await page.getByText(/혼자 다녀요/).waitFor();
check("[그만 따라오기] → 전시 동물 없음", (await one("SELECT showcase_animal_id AS id FROM blogs WHERE owner_id = $1", [uid])).id === null);

// 6) 농장 알 확률표에 용은 없다 (알에서 안 나온다)
const odds = await one("SELECT hatch_weight, price, reward_only FROM animal_species WHERE code = 'dragon'");
check("용: 알 비중 0, 분양 안 함, 보상 전용", odds.hatch_weight === 0 && odds.price === null && odds.reward_only === true);

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
