// 블로그 미니룸·주인 프로필·동물 도감·전시 동물 (BLOG-04 / US4-1~10, SC-008, quickstart 3.5)
// 사용: 개발 서버를 띄운 상태에서 node e2e/blog-showcase.mjs <스크린샷 폴더>
// 실행마다 새 회원을 만들고 DB로 다 키운 동물 3마리와 알 1개를 넣는다. DB는 .env.local의 DATABASE_URL.
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
const allErrors = [];

const n = Date.now() % 100_000_000;
const OWNER = `sc${n}`; // 다 키운 동물이 있는 블로그 주인
const OTHER = `sd${n}`; // 다른 회원 (다 키운 동물 없음)
const desktop = { viewport: { width: 1280, height: 900 } };
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };
const HUGE = 99999999999;

async function fresh(opts = desktop, storageState) {
  const ctx = await browser.newContext({ ...opts, storageState });
  const page = await ctx.newPage();
  allErrors.push(collectErrors(page));
  return { ctx, page };
}

const own = await fresh();
await loginDev(own.page, OWNER);
const oth = await fresh();
await loginDev(oth.page, OTHER, "여자 주민");
const guest = await fresh();
const owner = await one("SELECT u.id, b.id AS blog_id, b.title FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = $1", [OWNER]);
const other = await one("SELECT u.id FROM users u WHERE u.username = $1", [OTHER]);

// 다 키운 동물 3마리(병아리·토끼·아기 돼지, 다 키운 순서대로) + 알 1개, 다른 회원의 다 키운 동물 1마리
const addAnimal = (userId, code, status, minsAgo) =>
  one(
    `INSERT INTO user_animals (user_id, species_id, status, growth, source, hatched_at, grown_at)
     VALUES ($1, (SELECT id FROM animal_species WHERE code = $2), $3::animal_status, 0, 'shop', now(),
             CASE WHEN $3::animal_status = 'grown' THEN now() - make_interval(mins => $4) END) RETURNING id`,
    [userId, code, status, minsAgo],
  ).then((r) => r.id);
const chick = await addAnimal(owner.id, "chick", "grown", 30);
const bunny = await addAnimal(owner.id, "bunny", "grown", 20);
const piglet = await addAnimal(owner.id, "piglet", "grown", 10);
const egg = await one("INSERT INTO user_animals (user_id, status, source) VALUES ($1, 'egg', 'shop') RETURNING id", [owner.id]).then((r) => r.id);
const growing = await addAnimal(owner.id, "calf", "growing", 0);
const showcaseNow = async () => (await one("SELECT showcase_animal_id AS id FROM blogs WHERE id = $1", [owner.blog_id])).id;

/** 블로그 홈 미니룸·프로필·도감 모습 (보는 사람마다 비교) */
async function viewOf(page, slug = OWNER) {
  await page.goto(`${BASE}/@${slug}`);
  const main = page.locator("main");
  const room = main.locator("section.card").first().locator("> div").first();
  return {
    bg: await room.evaluate((el) => getComputedStyle(el).backgroundImage),
    character: await room.locator("img").first().getAttribute("src"),
    badge: (await room.locator("span.rounded-full").last().innerText()).trim(),
    showcase: await room.locator("[data-showcase]").count(),
    showcaseName: (await room.locator("[data-showcase]").count()) ? await room.locator("[data-showcase]").getAttribute("title") : null,
    profileImg: await main.locator("section.card").first().locator('img[src^="/files/"]').count(),
    nickname: (await main.locator("[data-owner-nickname]").innerText()).trim(),
    // 카드 글자 (주인에게만 있는 버튼 글자는 뺀다)
    cards: (await main.locator("[data-animal-card]").allInnerTexts()).map((t) => t.split("\n").map((l) => l.trim()).filter((l) => l && !/^전시(하기| 빼기)$/.test(l))),
    showButtons: await main.getByRole("button", { name: /전시하기|전시 빼기/ }).count(),
  };
}

// US4-1 방문자: 배경·캐릭터·닉네임 배지(블로그 이름 아님), 애니메이션 주기 2초
{
  await db.query("UPDATE profiles SET nickname = $2 WHERE user_id = $1", [owner.id, `닉${n}`]);
  const v = await viewOf(guest.page);
  check("US4-1 미니룸 배경 그림", v.bg.startsWith('url("data:image/svg+xml'), v.bg.slice(0, 40));
  check("US4-1 미니룸 캐릭터 그림", v.character?.startsWith("data:image/svg+xml"));
  check("US4-1 배지는 닉네임 (블로그 이름 아님)", v.badge === `닉${n}` && v.badge !== owner.title, v.badge);
  const anim = await guest.page.locator("main img.animate-bounce").first().evaluate((el) => getComputedStyle(el).animationDuration);
  check("US4-1 캐릭터 애니메이션 주기 2초", anim === "2s", anim);
}

// US4-2 꾸미기에서 배경 변경 → 블로그 홈 미니룸 배경이 바뀐다
{
  await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code = 'bg_snow' ON CONFLICT DO NOTHING", [owner.id]);
  const before = (await viewOf(guest.page)).bg;
  await own.page.goto(`${BASE}/closet`);
  await own.page.getByRole("button", { name: /눈/ }).first().click();
  await own.page.getByText(/장착을 저장했어요/).waitFor({ timeout: 10000 });
  const after = (await viewOf(guest.page)).bg;
  const code = (await one("SELECT i.code FROM blogs b JOIN items i ON i.id = b.background_item_id WHERE b.id = $1", [owner.blog_id])).code;
  check("US4-2 꾸미기에서 배경 변경 → 미니룸 배경 바뀜", before !== after && code === "bg_snow", code);
}

// US4-4 미니룸 높이: 375px 224px, 1280px 256px, 아래쪽 테두리 2px·나머지 0
{
  const box = async (page) =>
    page.locator("main section.card").first().locator("> div").first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { h: Math.round(el.getBoundingClientRect().height), b: s.borderBottomWidth, t: s.borderTopWidth, l: s.borderLeftWidth, r: s.borderRightWidth };
    });
  const d = await box(guest.page);
  const p = await fresh(phone);
  await p.page.goto(`${BASE}/@${OWNER}`);
  const m = await box(p.page);
  check("US4-4 1280px 미니룸 높이 256px", d.h === 256, `${d.h}px`);
  check("US4-4 375px 미니룸 높이 224px", m.h === 224, `${m.h}px`);
  check("US4-4 아래쪽 테두리 2px만", d.b === "2px" && d.t === "0px" && d.l === "0px" && d.r === "0px", JSON.stringify(d));
  await p.ctx.close();
}

// US4-6 도감 카드 3장 (알·자라는 중 제외, 다 키운 시각 최신순), 없는 회원은 `아직 다 키운 동물이 없어요`
{
  const v = await viewOf(guest.page);
  const names = v.cards.map((c) => c[0]);
  check("US4-6 도감 카드 3장 (알·자라는 중 없음)", v.cards.length === 3, `${v.cards.length}장`);
  check("US4-6 다 키운 시각 최신순", JSON.stringify(names) === JSON.stringify(["아기 돼지", "토끼", "병아리"]), names.join(","));
  await guest.page.goto(`${BASE}/@${OTHER}`);
  check("US4-6 다 키운 동물이 없으면 `아직 다 키운 동물이 없어요`", await guest.page.getByText("아직 다 키운 동물이 없어요").isVisible());
}

// US4-7·8 주인이 [전시하기] → 미니룸에 그 동물, 다른 동물로 바꿈(늘 1마리), [전시 빼기] → 빈 자리. 고르지 않은 회원은 빈 자리
{
  const v0 = await viewOf(own.page);
  check("US4-8 고르지 않았으면 전시 자리 비어 있음", v0.showcase === 0 && (await showcaseNow()) === null);
  check("US4-7 주인에게 [전시하기] 버튼 3개", v0.showButtons === 3, `${v0.showButtons}개`);
  const card = (name) => own.page.locator("[data-animal-card]", { hasText: name });
  const size = await card("토끼").getByRole("button", { name: "전시하기" }).boundingBox();
  check("US4-7 전시 버튼 44×44px 이상", size.width >= 44 && size.height >= 44, `${Math.round(size.width)}×${Math.round(size.height)}`);
  await card("토끼").getByRole("button", { name: "전시하기" }).click();
  await card("토끼").getByText("전시 중").waitFor({ timeout: 10000 });
  const v1 = await viewOf(guest.page);
  check("US4-7 [전시하기] → 미니룸에 토끼", v1.showcase === 1 && v1.showcaseName === "토끼" && (await showcaseNow()) === bunny, v1.showcaseName);
  await own.page.goto(`${BASE}/@${OWNER}`);
  await card("병아리").getByRole("button", { name: "전시하기" }).click();
  await card("병아리").getByText("전시 중").waitFor({ timeout: 10000 });
  const v2 = await viewOf(guest.page);
  check("US4-7 다른 동물 → 바뀜, 늘 1마리", v2.showcase === 1 && v2.showcaseName === "병아리" && (await showcaseNow()) === chick, v2.showcaseName);
  await own.page.screenshot({ path: `${outDir}/sc-01-owner.png`, fullPage: true });
  await own.page.goto(`${BASE}/@${OWNER}`);
  await card("병아리").getByRole("button", { name: "전시 빼기" }).click();
  await own.page.locator("[data-showcase]").waitFor({ state: "detached", timeout: 10000 });
  check("US4-7 [전시 빼기] → 빈 자리", (await showcaseNow()) === null && (await viewOf(guest.page)).showcase === 0);
}

// US4-9 setShowcaseAnimal 조작: 남의 동물·알·자라는 중·범위 밖·문자 → 그대로
{
  const othersAnimal = await addAnimal(other.id, "calf", "grown", 5);
  await own.page.goto(`${BASE}/@${OWNER}`);
  const reqP = own.page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await own.page.locator("[data-animal-card]", { hasText: "아기 돼지" }).getByRole("button", { name: "전시하기" }).click();
  const req = await reqP;
  await own.page.locator("[data-animal-card]", { hasText: "아기 돼지" }).getByText("전시 중").waitFor({ timeout: 10000 });
  const c = { actionId: req.headers()["next-action"], contentType: req.headers()["content-type"] };
  check("US4-9 진짜 요청 인자 = [동물 ID]", JSON.stringify(JSON.parse(req.postData())) === JSON.stringify([piglet]), req.postData());
  const replay = (args) =>
    own.page.evaluate(
      async ({ c, body }) =>
        (await fetch(location.href, { method: "POST", headers: { "Next-Action": c.actionId, Accept: "text/x-component", "Content-Type": c.contentType }, body })).status,
      { c, body: JSON.stringify(args) },
    );
  for (const [label, arg] of [
    ["남의 동물", othersAnimal],
    ["알", egg],
    ["자라는 중", growing],
    ["99999999999", HUGE],
    ['"abc"', "abc"],
    ["1.5", 1.5],
    ["undefined", undefined],
  ]) {
    const status = await replay(arg === undefined ? [] : [arg]);
    const now = await showcaseNow();
    check(`US4-9 ${label} → 500 없음, showcase_animal_id 그대로`, status === 200 && now === piglet, `HTTP ${status}, ${now}`);
  }
  // 다른 회원이 같은 Server Action으로 내 동물을 고르기 → 자기 블로그도 내 블로그도 그대로
  const othReq = oth.page;
  await othReq.goto(`${BASE}/@${OTHER}`);
  const status = await othReq.evaluate(
    async ({ c, body }) =>
      (await fetch(location.href, { method: "POST", headers: { "Next-Action": c.actionId, Accept: "text/x-component", "Content-Type": c.contentType }, body })).status,
    { c, body: JSON.stringify([bunny]) },
  );
  const othShow = (await one("SELECT showcase_animal_id AS id FROM blogs WHERE owner_id = $1", [other.id])).id;
  check("US4-9 다른 회원이 내 동물 ID로 고르기 → 아무것도 안 바뀜", status === 200 && othShow === null && (await showcaseNow()) === piglet, `${othShow}`);
  // 로그인하지 않은 요청 → 바뀌지 않음
  const anonStatus = await guest.page.evaluate(
    async ({ c, body }) =>
      (await fetch(location.href, { method: "POST", headers: { "Next-Action": c.actionId, Accept: "text/x-component", "Content-Type": c.contentType }, body })).status,
    { c, body: JSON.stringify([null]) },
  );
  check("US4-9 로그인 없이 비우기 요청 → 그대로", (await showcaseNow()) === piglet, `HTTP ${anonStatus}`);
}

// US4-10 세 컨텍스트에서 미니룸·프로필·전시·도감 동일, 전시 버튼은 주인에게만
{
  const vo = await viewOf(own.page);
  const vt = await viewOf(oth.page);
  const vg = await viewOf(guest.page);
  const same = (a, b) => a.bg === b.bg && a.character === b.character && a.badge === b.badge && a.showcaseName === b.showcaseName && a.nickname === b.nickname && JSON.stringify(a.cards) === JSON.stringify(b.cards);
  check("US4-10 주인·다른 회원·방문자 미니룸·프로필·전시·도감 같음", same(vo, vt) && same(vo, vg) && vo.showcaseName === "아기 돼지", `${vo.showcaseName}/${vt.showcaseName}/${vg.showcaseName}`);
  check("US4-10 전시 버튼은 주인에게만", vo.showButtons === 3 && vt.showButtons === 0 && vg.showButtons === 0, `${vo.showButtons}/${vt.showButtons}/${vg.showButtons}`);
  await guest.page.screenshot({ path: `${outDir}/sc-02-guest.png`, fullPage: true });
}

// 글 화면에는 미니룸이 없다 (FR-032)
{
  const post = await one("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, '전시 확인 글', '<p>x</p>', 'x') RETURNING id", [owner.blog_id]);
  await guest.page.goto(`${BASE}/@${OWNER}/${post.id}`);
  check("FR-032 글 화면에는 미니룸·전시 동물 없음", (await guest.page.locator("main img.animate-bounce, main [data-showcase]").count()) === 0);
}

// US4-5 프로필 사진: photo_key 연결 → /files/키 사진 + 닉네임, 없으면 캐릭터 얼굴
{
  const v0 = await viewOf(guest.page);
  check("US4-5 사진 없으면 캐릭터 얼굴 + 닉네임", v0.profileImg === 0 && v0.nickname === `닉${n}`);
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const up = await own.page.request.post(`${BASE}/api/uploads`, {
    multipart: { file: { name: "me.png", mimeType: "image/png", buffer: PNG } },
    headers: { Origin: BASE },
  });
  const { key } = await up.json();
  await db.query("UPDATE profiles SET photo_key = $2 WHERE user_id = $1", [owner.id, key]);
  const v1 = await viewOf(guest.page);
  const src = await guest.page.locator('main section.card img[src^="/files/"]').first().getAttribute("src");
  const res = await guest.page.request.get(`${BASE}${src}`);
  check("US4-5 photo_key 연결 → 방문자에게 /files/키 사진 + 닉네임", v1.profileImg === 1 && src === `/files/${key}` && v1.nickname === `닉${n}`, src);
  check("US4-5 방문자도 사진 200 (T045, /files 공개)", res.status() === 200 && res.headers()["content-type"] === "image/png", `HTTP ${res.status()}`);
  const size = await guest.page.locator('main section.card img[src^="/files/"]').first().boundingBox();
  check("US4-5 프로필 사진 48px 원형", Math.round(size.width) === 48 && Math.round(size.height) === 48, `${size.width}×${size.height}`);
  const ownerView = await viewOf(oth.page);
  check("US4-10 다른 회원도 같은 사진", ownerView.profileImg === 1);
}

// US4-3 장착 아이템 그림 키가 없는 값 → 오류 없이 회색 몸통·초원
{
  const ch = await one("INSERT INTO items (code, type, name, asset_key) VALUES ($1, 'character', '그림 없는 캐릭터', 'character.missing') RETURNING id", [`ch_missing_${n}`]);
  const bg = await one("INSERT INTO items (code, type, name, asset_key) VALUES ($1, 'background', '그림 없는 배경', 'bg.missing') RETURNING id", [`bg_missing_${n}`]);
  await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2), ($1, $3)", [owner.id, ch.id, bg.id]);
  await db.query("UPDATE profiles SET character_item_id = $2 WHERE user_id = $1", [owner.id, ch.id]);
  await db.query("UPDATE blogs SET background_item_id = $2 WHERE id = $1", [owner.blog_id, bg.id]);
  const before = allErrors.flat().length;
  const v = await viewOf(guest.page);
  const meadow = (await viewOf(guest.page, OTHER)).bg; // 다른 회원은 기본 초원
  check("US4-3 없는 그림 키 → 캐릭터 회색 몸통", decodeURIComponent(v.character).includes("#cfc4b8"));
  // 그라데이션 id에 그림 키가 붙으므로(-bgmeadow760) 그 부분만 빼고 비교한다
  const scene = (bg) => decodeURIComponent(bg).replace(/-\w+760\b/g, "");
  check("US4-3 없는 그림 키 → 배경 초원", scene(v.bg) === scene(meadow));
  const lost = await guest.page.getByText(/오류|문제가 생겼/).count();
  check("US4-3 오류 문구·콘솔 오류 없음", allErrors.flat().length === before && lost === 0);
  await guest.page.screenshot({ path: `${outDir}/sc-03-missing-art.png` });
  // 정리: 테스트 아이템을 떼고 지운다
  await db.query("UPDATE profiles SET character_item_id = (SELECT item_id FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.type = 'character' AND i.id <> $2 LIMIT 1) WHERE user_id = $1", [owner.id, ch.id]);
  await db.query("UPDATE blogs SET background_item_id = (SELECT id FROM items WHERE code = 'bg_meadow') WHERE id = $1", [owner.blog_id]);
  await db.query("DELETE FROM user_items WHERE item_id IN ($1, $2)", [ch.id, bg.id]);
  await db.query("DELETE FROM items WHERE id IN ($1, $2)", [ch.id, bg.id]);
}

// 전시한 동물이 지워지면 showcase_animal_id만 비워진다 (FK ON DELETE SET NULL (showcase_animal_id))
{
  await db.query("DELETE FROM user_animals WHERE id = $1", [piglet]);
  const row = await one("SELECT id, showcase_animal_id FROM blogs WHERE id = $1", [owner.blog_id]);
  check("FK 전시 동물 삭제 → 블로그는 남고 전시만 비움", row?.id === owner.blog_id && row.showcase_animal_id === null);
  const v = await viewOf(guest.page);
  check("FK 삭제 뒤 미니룸 전시 자리 비어 있음·도감 2장", v.showcase === 0 && v.cards.length === 2);
}

// 375px 블로그 홈(도감 포함) 가로 스크롤 0
{
  const p = await fresh(phone, await own.ctx.storageState());
  await p.page.goto(`${BASE}/@${OWNER}`);
  const overflow = await p.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("375px 도감이 있는 블로그 홈 가로 스크롤 0", overflow <= 0, `${overflow}px`);
  await p.page.screenshot({ path: `${outDir}/sc-04-owner-375.png`, fullPage: true });
  await p.ctx.close();
}

const errors = allErrors.flat();
check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
