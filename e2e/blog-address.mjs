// 블로그 이름·소개·주소와 닉네임 바꾸기 (BLOG-03 / US3, SC-005·006·008·012, quickstart 3.2)
// 사용: 개발 서버를 띄운 상태에서 node e2e/blog-address.mjs <스크린샷 폴더>
// 실행마다 새 회원 A·B를 만든다 (tester1 주소를 바꾸지 않는다). DB는 .env.local의 DATABASE_URL로 확인한다.
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
const A = `ba${n}`;
const B = `bb${n}`;
const desktop = { viewport: { width: 1280, height: 900 } };
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };
const MSG = {
  saved: "저장했어요 ✓",
  titleEmpty: "블로그 이름을 적어 주세요",
  titleLong: "블로그 이름은 40자까지예요",
  descLong: "소개는 160자까지예요",
  slugFormat: "주소는 영문 소문자, 숫자, _ 로 3~20자예요",
  slugReserved: "이 주소는 쓸 수 없어요",
  slugTaken: "이미 있는 주소예요",
  nickShort: "닉네임은 2자 이상이에요",
  nickLong: "닉네임은 20자까지예요",
  nickTaken: "이미 있는 닉네임이에요",
};

async function member(id, character) {
  const ctx = await browser.newContext(desktop);
  const page = await ctx.newPage();
  allErrors.push(collectErrors(page));
  await loginDev(page, id, character);
  const u = await one("SELECT u.id AS user_id, b.id AS blog_id FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = $1", [id]);
  return { ctx, page, userId: u.user_id, blogId: u.blog_id };
}
const blogOf = (userId) => one("SELECT slug, title, description FROM blogs WHERE owner_id = $1", [userId]);
const nickOf = async (userId) => (await one("SELECT nickname FROM profiles WHERE user_id = $1", [userId])).nickname;

// 화면의 입력 제한(maxLength·required)을 풀어 서버 검사를 본다
const noLimits = (form) => form.querySelectorAll("input, textarea").forEach((el) => (el.removeAttribute("maxLength"), el.removeAttribute("required")));
// 폼에 다른 칸을 섞는다 (조작 요청)
const addHidden = (form, extra) => {
  for (const [name, value] of Object.entries(extra)) {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = name;
    i.value = value;
    form.append(i);
  }
};

/** 폼을 보내고 결과 한 줄(오류 또는 저장했어요)을 기다린다 */
async function submit(page, form, button) {
  await form.getByRole("button", { name: button, exact: true }).click();
  const res = form.locator('[role="alert"], [role="status"]');
  const msg = await res
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => res.first().innerText(), () => "(결과 없음)");
  await page.waitForTimeout(300); // React가 폼을 되돌리는 시점 뒤에 칸 값을 읽는다
  return { msg, alerts: await form.locator('[role="alert"]').count() };
}

async function saveInfo(page, { title, description, extra }) {
  await page.goto(`${BASE}/settings/blog`);
  const form = page.locator("form", { has: page.getByLabel("블로그 이름") });
  await form.evaluate(noLimits);
  if (extra) await form.evaluate(addHidden, extra);
  if (title !== undefined) await form.getByLabel("블로그 이름").fill(title);
  if (description !== undefined) await form.getByLabel("소개").fill(description);
  const r = await submit(page, form, "저장");
  return { ...r, title: await form.getByLabel("블로그 이름").inputValue(), description: await form.getByLabel("소개").inputValue() };
}

async function saveSlug(page, slug, extra) {
  await page.goto(`${BASE}/settings/blog`);
  const form = page.locator("form", { has: page.getByLabel("블로그 주소") });
  await form.evaluate(noLimits);
  if (extra) await form.evaluate(addHidden, extra);
  await form.getByLabel("블로그 주소").fill(slug);
  const r = await submit(page, form, "주소 바꾸기");
  return { ...r, value: await form.getByLabel("블로그 주소").inputValue() };
}

async function saveNick(page, nickname) {
  await page.goto(`${BASE}/settings/account`);
  const form = page.locator("form", { has: page.getByLabel("닉네임", { exact: true }) });
  await form.evaluate(noLimits);
  await form.getByLabel("닉네임", { exact: true }).fill(nickname);
  const r = await submit(page, form, "저장");
  return { ...r, value: await form.getByLabel("닉네임", { exact: true }).inputValue() };
}

const a = await member(A);
const b = await member(B, "여자 주민");

// 글 하나 준비 (글 카드·글 상세 반영 확인용)
const post = await one(
  "INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, $2, '<p>주소 확인 글</p>', '주소 확인 글') RETURNING id",
  [a.blogId, `주소 확인 글 ${n}`],
);
// 글 카드는 이 시험만의 태그 화면에서 본다. 마을 소식 첫 장은 다른 시험(social)이 미래 시각으로 넣은 글이 차지할 수 있다
const TAG = `주소확인${n}`;
const tag = await one("INSERT INTO tags (name) VALUES ($1) RETURNING id", [TAG]);
await db.query("INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)", [post.id, tag.id]);

// ── US3-1 이름 저장 → 같은 화면 `저장했어요 ✓`, 사이트 전체 반영, 60초 안 ──
{
  const t0 = Date.now();
  const r = await saveInfo(a.page, { title: "  새 이름  " });
  const elapsed = Date.now() - t0;
  const saved = await blogOf(a.userId);
  check("US3-1 `  새 이름  ` → `저장했어요 ✓`, 같은 화면", r.msg === MSG.saved && new URL(a.page.url()).pathname === "/settings/blog", r.msg);
  check("US3-1 DB 이름은 앞뒤 공백을 지운 `새 이름`, 칸도 저장된 값", saved.title === "새 이름" && r.title === "새 이름", `${saved.title} / ${r.title}`);
  check("SC-006 설정 화면을 열고 저장까지 60초 안", elapsed < 60_000, `${elapsed}ms`);
  await a.page.goto(`${BASE}/@${A}`);
  check("US3-1 블로그 홈 제목·탭 제목", (await a.page.locator("main h1").innerText()) === "새 이름" && (await a.page.title()) === "새 이름 | Blogville", await a.page.title());
  await a.page.goto(`${BASE}/tags/${encodeURIComponent(TAG)}`);
  const card = a.page.locator("main article").filter({ hasText: `주소 확인 글 ${n}` });
  check("US3-1 글 카드의 블로그 이름", (await card.innerText()).includes("· 새 이름"));
  const ph = await browser.newContext({ ...phone, storageState: await a.ctx.storageState() });
  const pp = await ph.newPage();
  await pp.goto(`${BASE}/town?menu=1`);
  check("US3-1 휴대폰 ☰ 메뉴 내 프로필의 블로그 이름", (await pp.locator("[data-town-menu] [data-profile-blog]").innerText()).includes("새 이름"));
  await ph.close();
}

// ── US3-2 잘못된 이름·소개 → 첫 오류 하나만, DB 그대로, 칸에 보낸 값 남음 ──
for (const [label, input, want] of [
  ["공백만 이름", { title: "   ", description: "소개" }, MSG.titleEmpty],
  ["41자 이름", { title: "가".repeat(41), description: "소개" }, MSG.titleLong],
  ["161자 소개", { title: "새 이름", description: "나".repeat(161) }, MSG.descLong],
  ["41자 이름 + 161자 소개 → 이름 오류만", { title: "가".repeat(41), description: "나".repeat(161) }, MSG.titleLong],
]) {
  const r = await saveInfo(a.page, input);
  const saved = await blogOf(a.userId);
  check(
    `US3-2 ${label} → \`${want}\` 하나만, DB 그대로, 칸에 보낸 값`,
    r.msg === want && r.alerts === 1 && saved.title === "새 이름" && saved.description === "" && r.title === input.title && r.description === input.description,
    `${r.msg}, 칸 ${JSON.stringify([r.title.length, r.description.length])}`,
  );
}
await a.page.screenshot({ path: `${outDir}/ba-01-info-error.png`, fullPage: true });
{
  const r = await saveInfo(a.page, { title: "새 이름", description: "😀".repeat(160) });
  const saved = await blogOf(a.userId);
  check("US3-2 이모지 160개 소개는 160자로 통과 (코드 포인트)", r.msg === MSG.saved && [...saved.description].length === 160, r.msg);
}

// ── US3-3 소개를 비우면 블로그 홈에 소개 줄 없음 ──
{
  await saveInfo(a.page, { description: `소개 문장 ${n}` });
  await a.page.goto(`${BASE}/@${A}`);
  const shown = await a.page.getByText(`소개 문장 ${n}`).count();
  await saveInfo(a.page, { description: "" });
  await a.page.goto(`${BASE}/@${A}`);
  const after = await a.page.getByText(`소개 문장 ${n}`).count();
  const empty = (await blogOf(a.userId)).description;
  check("US3-3 소개 비움 → 소개 줄 없음", shown === 1 && after === 0 && empty === "", `${shown} → ${after}`);
}

// ── US3-4 주소 바꾸기: 정규화, 새 주소 200, 예전 주소 404, 링크에 예전 주소 0개 ──
const NEW = `my_${n}`;
{
  const r = await saveSlug(a.page, `  My_${n} `);
  const saved = await blogOf(a.userId);
  check("US3-4 `My_…` → `저장했어요 ✓`, DB·칸은 소문자", r.msg === MSG.saved && saved.slug === NEW && r.value === NEW, `${r.msg}, ${saved.slug}, 칸 ${r.value}`);
  await a.page.screenshot({ path: `${outDir}/ba-02-slug-saved.png`, fullPage: true });
  const guest = await browser.newContext(desktop);
  const g = await guest.newPage();
  const newRes = await g.goto(`${BASE}/@${NEW}`);
  const oldRes = await g.goto(`${BASE}/@${A}`);
  check("US3-4 /@{새 주소} 200, /@{예전 주소} 404", newRes.status() === 200 && oldRes.status() === 404, `${newRes.status()} / ${oldRes.status()}`);
  await g.screenshot({ path: `${outDir}/ba-03-old-slug-404.png` });
  await guest.close();

  // 사이트가 그린 링크에 예전 주소가 없다 (블로그 홈, 글 상세, 관리, 마을 소식, 광장 메뉴, 발행 뒤 이동)
  const hrefs = async (page) => page.locator("a[href]").evaluateAll((as) => as.map((x) => x.getAttribute("href")));
  const old = (h) => h === `/@${A}` || h.startsWith(`/@${A}/`) || h.startsWith(`/@${A}?`);
  const found = [];
  for (const path of [`/@${NEW}`, `/@${NEW}/${post.id}`, "/settings/blog", "/feed", `/tags/${encodeURIComponent(TAG)}`]) {
    await a.page.goto(`${BASE}${path}`);
    found.push(...(await hrefs(a.page)).filter(old));
  }
  const ph = await browser.newContext({ ...phone, storageState: await a.ctx.storageState() });
  const pp = await ph.newPage();
  await pp.goto(`${BASE}/town?menu=1`);
  found.push(...(await hrefs(pp)).filter(old));
  const myHouse = await pp.locator("[data-mobile-tabs]").getByRole("link", { name: /내 블로그/ }).getAttribute("href");
  await ph.close();
  check("US3-4 사이트가 그린 링크에 예전 주소 0개, 휴대폰 아래 탭 내 블로그는 새 주소", found.length === 0 && myHouse === `/@${NEW}`, `${found.join(",")} / ${myHouse}`);

  await a.page.goto(`${BASE}/write`);
  await a.page.locator(".ProseMirror").waitFor();
  await a.page.getByPlaceholder("제목").fill("새 주소에서 발행");
  await a.page.locator(".ProseMirror").click();
  await a.page.keyboard.type("주소를 바꾼 뒤 발행한 글");
  await a.page.getByRole("button", { name: "발행하기" }).click();
  await a.page.waitForURL(/\/@[a-z0-9_]+\/\d+/, { timeout: 20000 }).catch(() => {});
  check("US3-4 발행 뒤 이동 주소도 새 주소", new URL(a.page.url()).pathname.startsWith(`/@${NEW}/`), a.page.url());
}

// ── US3-5 잘못된 주소: 형식·예약어·다른 회원의 주소·다른 회원의 아이디 ──
const B_SLUG = `bs${n}`;
{
  const rb = await saveSlug(b.page, B_SLUG); // B가 주소를 아이디와 다르게 바꿔 둔다
  check("준비: B 주소 변경", rb.msg === MSG.saved, rb.msg);
}
for (const [label, value, want] of [
  ["`ab`", "ab", MSG.slugFormat],
  ["21자", "a".repeat(21), MSG.slugFormat],
  ["`my-blog`", "my-blog", MSG.slugFormat],
  ["`town`", "town", MSG.slugReserved],
  ["`Notice`(일반 회원)", "Notice", MSG.slugReserved],
  ["다른 회원의 주소", B_SLUG, MSG.slugTaken],
  ["다른 회원의 아이디", B, MSG.slugTaken],
  ["다른 회원의 아이디(대문자)", B.toUpperCase(), MSG.slugTaken],
]) {
  const r = await saveSlug(a.page, value);
  const saved = await blogOf(a.userId);
  check(`US3-5 ${label} → \`${want}\`, 주소 그대로, 칸에 보낸 값`, r.msg === want && saved.slug === NEW && r.value === value, `${r.msg}, ${saved.slug}, 칸 ${r.value}`);
}
await a.page.screenshot({ path: `${outDir}/ba-04-slug-error.png`, fullPage: true });

// ── US3-9 아이디 주소는 본인만 되돌릴 수 있다 ──
{
  const rb = await saveSlug(b.page, A);
  check("US3-9 다른 회원이 A의 아이디로 주소 변경 → 거부", rb.msg === MSG.slugTaken && (await blogOf(b.userId)).slug === B_SLUG, rb.msg);
  const ra = await saveSlug(a.page, A);
  check("US3-9 A 본인은 아이디 주소로 되돌림", ra.msg === MSG.saved && (await blogOf(a.userId)).slug === A, ra.msg);
}

// ── US3-10 풀린 주소는 바로 다른 회원이 쓸 수 있다 ──
{
  const X = `bx${n}`;
  const Y = `by${n}`;
  await saveSlug(a.page, X);
  await saveSlug(a.page, Y);
  const rb = await saveSlug(b.page, X);
  const g = await browser.newContext(desktop);
  const gp = await g.newPage();
  await gp.goto(`${BASE}/@${X}`);
  const title = await gp.locator("main h1").innerText();
  await g.close();
  check("US3-10 A가 x → y로 바꾼 직후 B가 x → 성공, /@x는 B 블로그", rb.msg === MSG.saved && (await blogOf(b.userId)).slug === X && title === `${B}의 블로그`, `${rb.msg}, ${title}`);
}

// ── US3-11 연달아 5번 바꿔도 매번 성공 ──
{
  const msgs = [];
  for (let i = 1; i <= 5; i++) msgs.push((await saveSlug(a.page, `c${i}_${n}`)).msg);
  check("US3-11 주소 5번 연속 변경 성공", msgs.every((m) => m === MSG.saved) && (await blogOf(a.userId)).slug === `c5_${n}`, msgs.join(","));
}
const A_SLUG = `c5_${n}`;

// ── US3-6 닉네임 ──
{
  const NICK = `닉${n}`;
  const B_NICK = `비닉${n}`;
  const r = await saveNick(a.page, ` ${NICK} `);
  check("US3-6 닉네임 정상 변경 → `저장했어요 ✓`, 칸·DB는 공백 제거 값", r.msg === MSG.saved && (await nickOf(a.userId)) === NICK && r.value === NICK, r.msg);
  await a.page.goto(`${BASE}/@${A_SLUG}`);
  const badge = await a.page.locator("div.bg-bottom").first().innerText();
  await a.page.goto(`${BASE}/@${A_SLUG}/${post.id}`);
  const detail = await a.page.locator("main").innerText();
  await a.page.goto(`${BASE}/tags/${encodeURIComponent(TAG)}`);
  const card = await a.page.locator("main article").filter({ hasText: `주소 확인 글 ${n}` }).innerText();
  const ph = await browser.newContext({ ...phone, storageState: await a.ctx.storageState() });
  const pp = await ph.newPage();
  await pp.goto(`${BASE}/town?menu=1`);
  const townText = await pp.locator("[data-town-menu]").innerText().catch(() => "");
  await ph.close();
  check("US3-6 미니룸 배지·글 상세·글 카드에 새 닉네임", badge.includes(NICK) && detail.includes(`· ${NICK}`) && card.includes(NICK), JSON.stringify({ badge, card: card.slice(0, 40) }));
  void townText; // 광장 이름표는 게임 화면(캔버스)이라 화면 글자로는 확인하지 않는다 (town.ts가 DB 닉네임을 읽는다)

  const rb = await saveNick(b.page, B_NICK);
  check("준비: B 닉네임 변경", rb.msg === MSG.saved, rb.msg);
  for (const [label, value, want] of [
    ["`가`", "가", MSG.nickShort],
    ["`😀` 하나 (500 없이)", "😀", MSG.nickShort],
    ["21자", "가".repeat(21), MSG.nickLong],
    ["다른 회원의 닉네임", B_NICK, MSG.nickTaken],
    ["다른 회원 아이디의 대문자", B.toUpperCase(), MSG.nickTaken],
  ]) {
    const r2 = await saveNick(a.page, value);
    check(`US3-6 ${label} → \`${want}\`, 닉네임 그대로, 칸에 보낸 값`, r2.msg === want && (await nickOf(a.userId)) === NICK && r2.value === value, `${r2.msg}, 칸 ${r2.value}`);
  }
  await a.page.screenshot({ path: `${outDir}/ba-05-nickname-error.png`, fullPage: true });
  const own = await saveNick(a.page, A.toUpperCase());
  check("US3-6 자기 아이디(대문자)는 닉네임으로 쓸 수 있음", own.msg === MSG.saved && (await nickOf(a.userId)) === A.toUpperCase(), own.msg);
  await a.page.screenshot({ path: `${outDir}/ba-06-nickname-saved.png`, fullPage: true });
}

// ── SC-012 같은 값으로 가입과 주소 변경을 동시에 → 한쪽만 성공 ──
{
  const V = `bc${n}`;
  await a.page.goto(`${BASE}/settings/blog`);
  const form = a.page.locator("form", { has: a.page.getByLabel("블로그 주소") });
  await form.getByLabel("블로그 주소").fill(V);
  const sctx = await browser.newContext(desktop);
  const s = await sctx.newPage();
  await s.goto(BASE);
  await s.getByRole("tab", { name: "회원가입" }).click();
  await s.getByLabel("아이디").fill(V);
  await s.getByLabel("비밀번호", { exact: true }).fill("race-pass-1234");
  await s.getByLabel("비밀번호 확인").fill("race-pass-1234");
  await Promise.all([form.getByRole("button", { name: "주소 바꾸기" }).click(), s.getByRole("button", { name: "회원가입", exact: true }).click()]);
  await Promise.all([
    form.locator('[role="alert"], [role="status"]').first().waitFor({ timeout: 20000 }).catch(() => {}),
    s.waitForURL(/\/@[a-z0-9_]+\?welcome=1/, { timeout: 20000 }).catch(() => s.locator('form [role="alert"]').waitFor({ timeout: 5000 }).catch(() => {})),
  ]);
  const signedUp = Boolean(await one("SELECT 1 AS x FROM users WHERE username = $1", [V]));
  const moved = (await blogOf(a.userId)).slug === V;
  check("SC-012 같은 값으로 가입과 주소 변경 동시 → 정확히 한쪽만 성공", signedUp !== moved, `가입 ${signedUp}, 주소 변경 ${moved}`);
  await sctx.close();
  if (moved) await saveSlug(a.page, A_SLUG);
}

// ── US3-7 이름·소개·주소 요청에 남의 값을 섞어도 내 블로그만 ──
{
  const bBefore = await blogOf(b.userId);
  const aBefore = await blogOf(a.userId);
  const r = await saveInfo(a.page, { title: "조작 이름", extra: { slug: `hack${n}`, ownerId: b.userId, blogId: String(b.blogId), owner_id: b.userId } });
  const aAfter = await blogOf(a.userId);
  const bAfter = await blogOf(b.userId);
  check(
    "US3-7 이름 저장에 slug·ownerId·blogId 섞기 → 내 블로그 이름만 바뀜",
    r.msg === MSG.saved && aAfter.title === "조작 이름" && aAfter.slug === aBefore.slug && JSON.stringify(bAfter) === JSON.stringify(bBefore),
    JSON.stringify({ a: aAfter.slug, b: bAfter.title }),
  );
  const rs = await saveSlug(a.page, `dz${n}`, { ownerId: b.userId, blogId: String(b.blogId) });
  const bAfter2 = await blogOf(b.userId);
  check("US3-7 주소 요청에 남의 ownerId·blogId 섞기 → 내 블로그 주소만", rs.msg === MSG.saved && (await blogOf(a.userId)).slug === `dz${n}` && bAfter2.slug === bBefore.slug, rs.msg);
}

// ── US3-8 로그아웃 상태 /settings/blog → / ──
{
  const g = await browser.newContext(desktop);
  const gp = await g.newPage();
  await gp.goto(`${BASE}/settings/blog`);
  const p1 = new URL(gp.url()).pathname;
  await gp.goto(`${BASE}/settings/account`);
  const p2 = new URL(gp.url()).pathname;
  check("US3-8 로그아웃 상태 /settings/blog·/settings/account → /", p1 === "/" && p2 === "/", `${p1}, ${p2}`);
  await g.close();
}

// ── 375px 블로그 관리·내 정보: 가로 스크롤 0, 버튼 44px ──
{
  const ph = await browser.newContext({ ...phone, storageState: await a.ctx.storageState() });
  const pp = await ph.newPage();
  allErrors.push(collectErrors(pp));
  const sizes = [];
  let overflow = 0;
  for (const [path, names] of [
    ["/settings/blog", ["저장", "주소 바꾸기", "내 블로그로 →"]],
    ["/settings/account", ["저장"]],
  ]) {
    await pp.goto(`${BASE}${path}`);
    overflow = Math.max(overflow, await pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
    for (const name of names) {
      const box = await pp.getByRole(name.endsWith("→") ? "link" : "button", { name, exact: true }).first().boundingBox();
      sizes.push(`${name} ${Math.round(box.width)}×${Math.round(box.height)}`);
      if (box.width < 44 || box.height < 44) sizes.push("❌");
    }
    await pp.screenshot({ path: `${outDir}/ba-07-375${path.replaceAll("/", "-")}.png`, fullPage: true });
  }
  check("375px 블로그 관리·내 정보 가로 스크롤 0", overflow <= 0, `${overflow}px`);
  check("375px [저장]·[주소 바꾸기]·`내 블로그로 →` 44×44px 이상", !sizes.includes("❌"), sizes.join(", "));
  await ph.close();
}

// 일부러 연 404 주소(예전 주소)의 "Failed to load resource: 404"는 오류로 보지 않는다
const errors = allErrors.flat().filter((e) => !e.includes("status of 404"));
check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
