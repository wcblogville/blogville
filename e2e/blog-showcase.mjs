// 블로그 우리 집 방의 주인 캐릭터·전시 동물, 제목 줄 주인 프로필, 동물 도감 (BLOG-04 / US4-1~10, SC-008, quickstart 3.5)
// 프로필 카드는 없앴다 (사용자 요청 2026-10-11): 캐릭터·전시 동물은 방 안을 걷고, 사진·닉네임은 제목 줄, [🏅 도감]은 방 도구 줄
// 사용: 개발 서버를 띄운 상태에서 node e2e/blog-showcase.mjs <스크린샷 폴더>
// 실행마다 새 회원을 만들고 DB로 다 키운 동물 3마리와 알 1개를 넣는다. DB는 .env.local의 DATABASE_URL.
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev, walkInRoom } from "./helpers.mjs";

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
    `INSERT INTO user_animals (user_id, sex, species_id, status, growth, source, hatched_at, grown_at)
     VALUES ($1, 'female', (SELECT id FROM animal_species WHERE code = $2), $3::animal_status, 0, 'shop', now(),
             CASE WHEN $3::animal_status = 'grown' THEN now() - make_interval(mins => $4) END) RETURNING id`,
    [userId, code, status, minsAgo],
  ).then((r) => r.id);
const chick = await addAnimal(owner.id, "chick", "grown", 30);
const bunny = await addAnimal(owner.id, "bunny", "grown", 20);
const piglet = await addAnimal(owner.id, "piglet", "grown", 10);
const egg = await one("INSERT INTO user_animals (user_id, status, source) VALUES ($1, 'egg', 'shop') RETURNING id", [owner.id]).then((r) => r.id);
const growing = await addAnimal(owner.id, "calf", "growing", 0);
const showcaseNow = async () => (await one("SELECT showcase_animal_id AS id FROM blogs WHERE id = $1", [owner.blog_id])).id;

/** 우리 집 방 도구 줄의 [🏅 도감] 버튼으로 도감 창을 연다 (사용자 요청 2026-10-09: 도감은 버튼 → 창) */
async function openCollection(page) {
  await page.locator("[data-collection-open]").click();
  await page.locator("dialog[data-collection]").waitFor();
}

/** 블로그 홈 방 안 캐릭터·전시 동물·제목 줄·도감 모습 (보는 사람마다 비교). 도감 창을 열어 둔 채로 돌려준다 */
async function viewOf(page, slug = OWNER) {
  await page.goto(`${BASE}/@${slug}`);
  await openCollection(page);
  const main = page.locator("main");
  const room = main.locator("[data-house-room]");
  const resident = room.locator("[data-room-resident]");
  return {
    character: await resident.evaluate((el) => getComputedStyle(el).backgroundImage),
    look: await resident.getAttribute("data-look"),
    showcase: await room.locator("[data-showcase]").count(),
    showcaseName: (await room.locator("[data-showcase]").count()) ? await room.locator("[data-showcase]").getAttribute("title") : null,
    profileImg: await main.locator("[data-blog-title-bar]").locator('img[src^="/files/"]').count(),
    nickname: (await main.locator("[data-owner-nickname]").innerText()).trim(),
    // 카드 글자 (주인에게만 있는 버튼 글자는 뺀다)
    // 이름 뒤 암수 표시(♀/♂, 2026-10-12)는 떼고 이름만
    cards: (await main.locator("[data-animal-card]").allInnerTexts()).map((t) => t.split("\n").map((l) => l.trim().replace(/\s*[♀♂](암컷|수컷)?$/, "")).filter((l) => l && !/^전시(하기| 빼기)$/.test(l))),
    showButtons: await main.getByRole("button", { name: /전시하기|전시 빼기/ }).count(),
  };
}

// US4-1 방문자: 프로필 카드 없음, 방 안에 주인 캐릭터(걷기 그림판)가 걷는다, 제목 줄에 닉네임
{
  await db.query("UPDATE profiles SET nickname = $2 WHERE user_id = $1", [owner.id, `닉${n}`]);
  const v = await viewOf(guest.page);
  check("프로필 카드 없음", (await guest.page.locator("[data-profile-card], [data-showcase-line]").count()) === 0);
  check("US4-1 방 안 주인 캐릭터 그림 (도트 걷기 그림판)", v.character.startsWith('url("data:image/svg+xml'), v.character.slice(0, 40));
  check("US4-1 제목 줄 닉네임 (블로그 이름 아님)", v.nickname === `닉${n}` && v.nickname !== owner.title, v.nickname);
  await guest.page.keyboard.press("Escape");
  // 2026-10-12: 혼자 돌아다니지 않는다. 방문자도 바닥을 누르면 그 칸으로 걷는다 (저장하지 않음)
  await walkInRoom(guest.page);
  const walked = await guest.page
    .waitForFunction(() => document.querySelector("[data-room-resident]")?.dataset.walk?.startsWith("walk-"), null, { timeout: 9000 })
    .then(() => true, () => false);
  check("US4-1 바닥을 누르면 캐릭터가 걷는다 (data-walk=walk-…)", walked, await guest.page.locator("[data-room-resident]").getAttribute("data-walk"));
  const box = await guest.page.locator("[data-room-resident]").boundingBox();
  check("US4-1 캐릭터 96×96px (24칸 × 4배, 정수배)", Math.round(box.width) === 96 && Math.round(box.height) === 96, `${box.width}×${box.height}`);
}

// US4-2 옷장에서 아바타를 바꾸면 방 안 캐릭터도 바뀐다
{
  const before = (await viewOf(guest.page)).look;
  const part = await one("SELECT id, asset_key FROM items WHERE code = 'hat_straw'");
  await db.query("INSERT INTO user_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [owner.id, part.id]);
  await db.query("INSERT INTO avatar_equips (user_id, slot, item_id) VALUES ($1, 'hat', $2) ON CONFLICT (user_id, slot) DO UPDATE SET item_id = $2", [owner.id, part.id]);
  const after = (await viewOf(guest.page)).look;
  check("US4-2 입은 아바타 → 방 안 캐릭터 그림 바뀜", before !== after && after.includes(part.asset_key), `${before} → ${after}`);
  await db.query("DELETE FROM avatar_equips WHERE user_id = $1 AND slot = 'hat'", [owner.id]);
}

// US4-2 꾸미기에서 배경 변경 → 우리 집 창밖 풍경이 바뀐다 (프로필 카드 미니룸 대신, 2026-10-11)
{
  const view = (page) => page.locator("[data-house-room] [data-window-view]").getAttribute("data-window-view");
  await db.query("INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE code = 'bg_snow' ON CONFLICT DO NOTHING", [owner.id]);
  await guest.page.goto(`${BASE}/@${OWNER}`);
  const before = await view(guest.page);
  await own.page.goto(`${BASE}/closet`);
  await own.page.getByRole("button", { name: /눈/ }).first().click();
  await own.page.getByText(/장착을 저장했어요/).waitFor({ timeout: 10000 });
  await guest.page.goto(`${BASE}/@${OWNER}`);
  const after = await view(guest.page);
  check("US4-2 꾸미기에서 배경 변경 → 창밖 풍경 바뀜", before === "bg.meadow" && after === "bg.snow", `${before} → ${after}`);
}

// US4-4 위쪽: 제목 줄 → 너비를 다 쓰는 방 (1280px·375px 모두 같은 너비, 위아래로)
{
  const boxes = async (page) => ({
    bar: await page.locator("[data-blog-title-bar]").boundingBox(),
    room: await page.locator("[data-house-room]").boundingBox(),
  });
  const d = await boxes(guest.page);
  const p = await fresh(phone);
  await p.page.goto(`${BASE}/@${OWNER}`);
  const m = await boxes(p.page);
  for (const [label, b] of [["1280px", d], ["375px", m]]) {
    check(`US4-4 ${label} 제목 줄 위·방 아래, 너비 같음`, b.bar.y + b.bar.height <= b.room.y && Math.abs(b.bar.width - b.room.width) < 1, `제목 ${Math.round(b.bar.width)}, 방 ${Math.round(b.room.width)}`);
  }
  check("US4-4 1280px 방이 넓다 (1000px 이상)", d.room.width >= 1000, `${Math.round(d.room.width)}px`);
  await p.ctx.close();
}

// US4-6 도감 카드 3장 (알·자라는 중 제외, 다 키운 시각 최신순), 없는 회원은 `아직 다 키운 동물이 없어요`
{
  const v = await viewOf(guest.page);
  const names = v.cards.map((c) => c[0]);
  check("US4-6 도감 카드 3장 (알·자라는 중 없음)", v.cards.length === 3, `${v.cards.length}장`);
  check("US4-6 다 키운 시각 최신순", JSON.stringify(names) === JSON.stringify(["아기 돼지", "토끼", "병아리"]), names.join(","));
  await guest.page.goto(`${BASE}/@${OTHER}`);
  await openCollection(guest.page);
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
  check("US4-7 [전시하기] → 방 안에 토끼", v1.showcase === 1 && v1.showcaseName === "토끼" && (await showcaseNow()) === bunny, v1.showcaseName);
  await own.page.goto(`${BASE}/@${OWNER}`);
  await openCollection(own.page);
  await card("병아리").getByRole("button", { name: "전시하기" }).click();
  await card("병아리").getByText("전시 중").waitFor({ timeout: 10000 });
  const v2 = await viewOf(guest.page);
  check("US4-7 다른 동물 → 바뀜, 늘 1마리", v2.showcase === 1 && v2.showcaseName === "병아리" && (await showcaseNow()) === chick, v2.showcaseName);
  await own.page.screenshot({ path: `${outDir}/sc-01-owner.png`, fullPage: true });
  await own.page.goto(`${BASE}/@${OWNER}`);
  await openCollection(own.page);
  await card("병아리").getByRole("button", { name: "전시 빼기" }).click();
  await own.page.locator("[data-showcase]").waitFor({ state: "detached", timeout: 10000 });
  check("US4-7 [전시 빼기] → 빈 자리", (await showcaseNow()) === null && (await viewOf(guest.page)).showcase === 0);
}

// US4-9 setShowcaseAnimal 조작: 남의 동물·알·자라는 중·범위 밖·문자 → 그대로
{
  const othersAnimal = await addAnimal(other.id, "calf", "grown", 5);
  await own.page.goto(`${BASE}/@${OWNER}`);
  await openCollection(own.page);
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
  const same = (a, b) => a.character === b.character && a.showcaseName === b.showcaseName && a.nickname === b.nickname && JSON.stringify(a.cards) === JSON.stringify(b.cards);
  check("US4-10 주인·다른 회원·방문자 방 안 캐릭터·제목 줄·전시·도감 같음", same(vo, vt) && same(vo, vg) && vo.showcaseName === "아기 돼지", `${vo.showcaseName}/${vt.showcaseName}/${vg.showcaseName}`);
  check("US4-10 전시 버튼은 주인에게만", vo.showButtons === 3 && vt.showButtons === 0 && vg.showButtons === 0, `${vo.showButtons}/${vt.showButtons}/${vg.showButtons}`);
  await guest.page.screenshot({ path: `${outDir}/sc-02-guest.png`, fullPage: true });
}

// 글 화면에는 미니룸이 없다 (FR-032)
{
  const post = await one("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, '전시 확인 글', '<p>x</p>', 'x') RETURNING id", [owner.blog_id]);
  await guest.page.goto(`${BASE}/@${OWNER}/${post.id}`);
  check("FR-032 글 화면에는 방 안 캐릭터·전시 동물 없음", (await guest.page.locator("main [data-room-resident], main [data-showcase]").count()) === 0);
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
  const src = await guest.page.locator('main [data-blog-title-bar] img[src^="/files/"]').first().getAttribute("src");
  const res = await guest.page.request.get(`${BASE}${src}`);
  check("US4-5 photo_key 연결 → 방문자에게 /files/키 사진 + 닉네임", v1.profileImg === 1 && src === `/files/${key}` && v1.nickname === `닉${n}`, src);
  check("US4-5 방문자도 사진 200 (T045, /files 공개)", res.status() === 200 && res.headers()["content-type"] === "image/png", `HTTP ${res.status()}`);
  const size = await guest.page.locator('main [data-blog-title-bar] img[src^="/files/"]').first().boundingBox();
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
  check("US4-3 없는 그림 키 → 캐릭터 회색 몸통", decodeURIComponent(v.character).includes("#cfc4b8"));
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
