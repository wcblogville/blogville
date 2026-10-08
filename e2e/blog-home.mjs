// 가입하면 생기는 블로그와 블로그 홈 보기 (BLOG-01, BLOG-02 / US1, US2, SC-001·004·009·012, quickstart 3.1)
// 사용: 개발 서버를 띄운 상태에서 node e2e/blog-home.mjs <스크린샷 폴더>
// 실행마다 새 회원을 만든다 (tester1 주소를 바꾸지 않는다). DB는 .env.local의 DATABASE_URL로 준비·확인한다.
// npm run admin:create 를 두 번 실행한다 (관리자 아이디·비밀번호는 .env.local에서 읽고 출력하지 않는다).
import { execFileSync } from "node:child_process";
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
const OWNER = `bh${n}`; // 글이 있는 블로그 주인
const OTHER = `bo${n}`; // 다른 회원 (글 없는 블로그)
const desktop = { viewport: { width: 1280, height: 900 } };
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };

async function fresh(opts = desktop) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  allErrors.push(collectErrors(page));
  return { ctx, page };
}

// ───────────── US1 가입하면 내 블로그가 자동으로 생긴다 ─────────────
const own = await fresh();
await loginDev(own.page, OWNER); // 새 아이디라 가입 → 광장
check("US1-1 가입 직후 광장으로 이동", new URL(own.page.url()).pathname === "/town", own.page.url());
const user = await one("SELECT id FROM users WHERE username = $1", [OWNER]);
const blogRows = (
  await db.query(
    `SELECT b.id, b.slug, b.title, b.description, i.code AS bg FROM blogs b JOIN items i ON i.id = b.background_item_id WHERE b.owner_id = $1`,
    [user.id],
  )
).rows;
const blog = blogRows[0];
check("US1-1 블로그가 정확히 1개", blogRows.length === 1, `${blogRows.length}개`);
check("US1-1 주소 = 아이디", blog?.slug === OWNER, blog?.slug);
check("US1-1 이름 `{아이디}의 블로그`", blog?.title === `${OWNER}의 블로그`, blog?.title);
check("US1-1 소개는 빈 값", blog?.description === "", JSON.stringify(blog?.description));
check("US1-1 배경 초원", blog?.bg === "bg_meadow", blog?.bg);
const cats = (await db.query("SELECT name, position FROM categories WHERE blog_id = $1", [blog.id])).rows;
check("US1-1 대분류 \"일상\" 1개", cats.length === 1 && cats[0].name === "일상" && cats[0].position === 0, JSON.stringify(cats));

// US1-2 광장 내 집(휴대폰 메뉴의 내 블로그)과 블로그 관리 `내 블로그로 →`
{
  const ctx = await browser.newContext({ ...phone, storageState: await own.ctx.storageState() });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/town`);
  const href = await p.locator("[data-town-menu]").getByRole("link", { name: /내 블로그/ }).getAttribute("href");
  check("US1-2 광장 내 집 → /@{아이디}", href === `/@${OWNER}`, href);
  await ctx.close();
}
await own.page.goto(`${BASE}/settings/blog`);
const mine = await own.page.getByRole("link", { name: "내 블로그로 →" }).getAttribute("href");
check("US1-2 블로그 관리 `내 블로그로 →` → /@{아이디}", mine === `/@${OWNER}`, mine);
await own.page.getByRole("link", { name: "내 블로그로 →" }).click();
await own.page.waitForURL(`${BASE}/@${OWNER}`);
check("US1-2 `내 블로그로 →`를 누르면 내 블로그 홈", (await own.page.locator("h1").first().innerText()) === `${OWNER}의 블로그`);

// US1-4 같은 회원의 블로그를 더 만들 수 없다 (UNIQUE blogs_owner_id_unique). 동시 두 요청도 1개
{
  const insert = (slug) =>
    db
      .query("INSERT INTO blogs (owner_id, slug, title, background_item_id) SELECT owner_id, $2, 'x', background_item_id FROM blogs WHERE id = $1", [blog.id, slug])
      .then(() => "inserted", (e) => e.constraint ?? e.message);
  const single = await insert(`x1${n}`);
  check("US1-4 블로그 하나 더 INSERT → blogs_owner_id_unique 거부", single === "blogs_owner_id_unique", single);
  const both = await Promise.all([insert(`x2${n}`), insert(`x3${n}`)]);
  const count = (await one("SELECT count(*)::int AS c FROM blogs WHERE owner_id = $1", [user.id])).c;
  check("US1-4 동시 두 INSERT도 블로그 1개", count === 1 && both.every((r) => r === "blogs_owner_id_unique"), `${count}개, ${both.join(",")}`);
}

// US1-5 블로그 만들기·지우기 버튼이 어디에도 없다
for (const path of [`/@${OWNER}`, "/settings/blog", "/closet"]) {
  await own.page.goto(`${BASE}${path}`);
  const found = await own.page.getByRole("button").or(own.page.getByRole("link")).filter({ hasText: /블로그\s*(만들기|지우기|삭제|추가)/ }).count();
  check(`US1-5 ${path}에 블로그 만들기·지우기 버튼 없음`, found === 0, `${found}개`);
}

// US1-6 관리자 블로그 /@notice — admin:create를 두 번 실행해도 1개
{
  const run = () => {
    try {
      execFileSync("npm", ["run", "admin:create"], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  };
  const ran = run() && run();
  const rows = (await db.query("SELECT id, title, description FROM blogs WHERE slug = 'notice'")).rows;
  const notice = rows[0];
  const noticeCats = notice ? (await db.query("SELECT name FROM categories WHERE blog_id = $1", [notice.id])).rows.map((r) => r.name) : [];
  check("US1-6 admin:create 두 번 실행 성공", ran);
  check("US1-6 /@notice 블로그 1개", rows.length === 1, `${rows.length}개`);
  check("US1-6 이름 `Blogville 공지사항`·소개", notice?.title === "Blogville 공지사항" && notice?.description === "마을 소식과 업데이트를 알려드려요", JSON.stringify(notice));
  check("US1-6 대분류 \"공지\"", JSON.stringify(noticeCats) === JSON.stringify(["공지"]), JSON.stringify(noticeCats));
  const res = await own.page.goto(`${BASE}/@notice`);
  check("US1-6 /@notice 200", res.status() === 200, `HTTP ${res.status()}`);
}

// US1-7 예약어 아이디로 가입 → `이 아이디는 쓸 수 없어요`, 회원·블로그 0
{
  const { ctx, page } = await fresh();
  for (const id of ["town", "notice", "Admin"]) {
    const usersBefore = (await one("SELECT count(*)::int AS c FROM users")).c;
    const blogsBefore = (await one("SELECT count(*)::int AS c FROM blogs")).c;
    await page.goto(BASE);
    await page.getByRole("tab", { name: "회원가입" }).click();
    await page.getByLabel("아이디").fill(id);
    await page.getByLabel("비밀번호", { exact: true }).fill("blog-home-pass-1");
    await page.getByLabel("비밀번호 확인").fill("blog-home-pass-1");
    await page.getByRole("button", { name: "회원가입", exact: true }).click();
    const alert = page.locator('form [role="alert"]');
    const msg = await alert.waitFor({ timeout: 15000 }).then(() => alert.innerText(), () => "(문구 없음)");
    const usersAfter = (await one("SELECT count(*)::int AS c FROM users")).c;
    const blogsAfter = (await one("SELECT count(*)::int AS c FROM blogs")).c;
    check(`US1-7 아이디 ${id} → \`이 아이디는 쓸 수 없어요\`, 회원·블로그 늘지 않음`, msg === "이 아이디는 쓸 수 없어요" && usersAfter === usersBefore && blogsAfter === blogsBefore, msg);
  }
  await ctx.close();
}

// ───────────── US2 누구나 /@주소로 블로그 홈을 본다 ─────────────
// 글 준비 (DB): "일상"에 공개 글 10개 + 비공개 글 1개
const dailyId = (await one("SELECT id FROM categories WHERE blog_id = $1 AND name = '일상'", [blog.id])).id;
for (let i = 1; i <= 10; i++) {
  await db.query(
    "INSERT INTO posts (blog_id, category_id, title, content_html, content_text, created_at) VALUES ($1, $2, $3, '<p>본문</p>', '본문', now() - make_interval(mins => $4))",
    [blog.id, dailyId, `공개 글 ${i}`, 20 - i],
  );
}
const priv = await one(
  "INSERT INTO posts (blog_id, category_id, title, content_html, content_text, visibility) VALUES ($1, $2, '비밀 일기', '<p>비밀</p>', '비밀', 'private') RETURNING id",
  [blog.id, dailyId],
);

const oth = await fresh();
await loginDev(oth.page, OTHER, "여자 주민");
const guest = await fresh();

/** 블로그 홈의 보는 사람별 모습 */
async function viewOf(page) {
  await page.goto(`${BASE}/@${OWNER}`);
  const main = page.locator("main");
  const has = async (role, name) => (await main.getByRole(role, { name }).count()) > 0;
  return {
    write: await has("link", "✏️ 글쓰기"),
    closet: await has("link", "🎨 꾸미기"),
    manage: await has("link", "⚙️ 관리"),
    follow: (await has("button", "+ 이웃 추가")) || (await has("button", "✓ 이웃")),
    privatePost: (await main.getByText("비밀 일기").count()) > 0,
    badge: (await main.getByText("🔒 비공개").count()) > 0,
    daily: (await main.getByRole("navigation", { name: "카테고리" }).getByRole("link", { name: /일상/ }).innerText()).replace(/\s+/g, " "),
    total: (await main.getByRole("navigation", { name: "카테고리" }).getByRole("link", { name: /전체 글/ }).innerText()).replace(/\s+/g, " "),
    title: await page.title(),
  };
}
const vOwner = await viewOf(own.page);
const vOther = await viewOf(oth.page);
const vGuest = await viewOf(guest.page);
check("US2-1 주인: [✏️ 글쓰기] [🎨 꾸미기] [⚙️ 관리], 이웃 버튼 없음", vOwner.write && vOwner.closet && vOwner.manage && !vOwner.follow, JSON.stringify(vOwner));
check("US2-1 다른 회원: 이웃 버튼만", vOther.follow && !vOther.write && !vOther.closet && !vOther.manage);
check("US2-1 방문자: 버튼 없음", !vGuest.follow && !vGuest.write && !vGuest.closet && !vGuest.manage);
check("US2-3 비공개 글은 주인에게만 + `🔒 비공개` 배지", vOwner.privatePost && vOwner.badge && !vOther.privatePost && !vGuest.privatePost && !vGuest.badge);
check("US2-3 카테고리 글 수: 주인은 비공개 포함 (11), 남은 (10)", vOwner.daily.includes("(11)") && vOther.daily.includes("(10)") && vGuest.daily.includes("(10)"), `${vOwner.daily} / ${vGuest.daily}`);
check("US2-3 `전체 글 (N)`은 공개 글 수", [vOwner, vOther, vGuest].every((v) => v.total.includes("(10)")), vOwner.total);
check("US2-4 탭 제목 `{블로그 이름} | Blogville`", [vOwner, vOther, vGuest].every((v) => v.title === `${OWNER}의 블로그 | Blogville`), vGuest.title);
await guest.page.screenshot({ path: `${outDir}/bh-01-guest.png`, fullPage: true });
await own.page.goto(`${BASE}/@${OWNER}`);
await own.page.screenshot({ path: `${outDir}/bh-02-owner.png`, fullPage: true });

// US2-2 404: 대문자 주소, 없는 주소, 다른 블로그 글, 남의 비공개 글, 이상한 글 ID
{
  const otherBlog = await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [OTHER]);
  const otherPost = await one("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, '남의 글', '<p>x</p>', 'x') RETURNING id", [otherBlog.id]);
  const paths = [
    "/@Notice",
    `/@${OWNER.toUpperCase()}`,
    `/@nobody_${n}`,
    `/@${OWNER}/${otherPost.id}`,
    `/@${OWNER}/${priv.id}`,
    ...["abc", "0", "012", "1e1", "2147483648"].map((v) => `/@${OWNER}/${v}`),
  ];
  for (const path of paths) {
    const res = await guest.page.goto(`${BASE}${path}`);
    const lost = await guest.page.getByRole("heading", { name: "길을 잃었어요" }).isVisible();
    check(`US2-2 ${path} → 404 \`길을 잃었어요\``, res.status() === 404 && lost, `HTTP ${res.status()}`);
  }
  await db.query("DELETE FROM posts WHERE id = $1", [otherPost.id]);
  await guest.page.screenshot({ path: `${outDir}/bh-03-404.png` });
}

// US2-6 대분류 선택 → 노란 배경, 2페이지에서도 유지
{
  const p = guest.page;
  const selected = async () =>
    p
      .getByRole("navigation", { name: "카테고리" })
      .getByRole("link", { name: /일상/ })
      .evaluate((a) => ({ bg: getComputedStyle(a).backgroundColor, bold: Number(getComputedStyle(a).fontWeight) >= 700 }));
  await p.goto(`${BASE}/@${OWNER}?category=${dailyId}`);
  const s1 = await selected();
  const heading1 = await p.locator("main h2").filter({ hasText: "개" }).first().innerText();
  await p.goto(`${BASE}/@${OWNER}?category=${dailyId}&page=2`);
  const s2 = await selected();
  const cards2 = await p.locator("main article").count();
  const yellow = "rgb(255, 243, 214)";
  check("US2-6 대분류 선택 → 노란 배경·굵게", s1.bg === yellow && s1.bold, JSON.stringify(s1));
  check("US2-6 2페이지에서도 선택 유지 (글 2개)", s2.bg === yellow && cards2 === 2, `${JSON.stringify(s2)}, 카드 ${cards2}`);
  check("US2-6 목록 제목 `일상 10개`", heading1.replace(/\s+/g, " ") === "일상 10개", heading1);
}

// US2-7 글 없는 블로그: `🌱 아직 글이 없어요.`, [첫 글 쓰기]는 주인만
{
  await guest.page.goto(`${BASE}/@${OTHER}`);
  const emptyGuest = await guest.page.getByText("아직 글이 없어요.").isVisible();
  const firstGuest = await guest.page.getByRole("link", { name: "첫 글 쓰기" }).count();
  await oth.page.goto(`${BASE}/@${OTHER}`);
  const firstOwner = await oth.page.getByRole("link", { name: "첫 글 쓰기" }).getAttribute("href");
  check("US2-7 글 없는 블로그 `🌱 아직 글이 없어요.`", emptyGuest && (await guest.page.getByText("🌱").isVisible()));
  check("US2-7 [첫 글 쓰기]는 주인만 (→ /write)", firstGuest === 0 && firstOwner === "/write", `방문자 ${firstGuest}개, 주인 ${firstOwner}`);
}

// US2-8 375px: 가로 스크롤 0, 주인 버튼 글자 한 줄, 누르는 영역 44×44px 이상
{
  const size = (loc) => loc.boundingBox().then((b) => ({ w: Math.round(b.width), h: Math.round(b.height) }));
  const big = (b) => b.w >= 44 && b.h >= 44;
  const ctx = await browser.newContext({ ...phone, storageState: await own.ctx.storageState() });
  const p = await ctx.newPage();
  allErrors.push(collectErrors(p));
  await p.goto(`${BASE}/@${OWNER}`);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("US2-8 375px 블로그 홈 가로 스크롤 0", overflow <= 0, `${overflow}px`);
  const main = p.locator("main");
  for (const name of ["✏️ 글쓰기", "🎨 꾸미기", "⚙️ 관리"]) {
    const b = await size(main.getByRole("link", { name }));
    check(`US2-8 375px 주인 버튼 ${name} 한 줄·44×44px 이상`, big(b) && b.h < 60, `${b.w}×${b.h}`);
  }
  const titleLink = await size(main.getByRole("link", { name: `${OWNER}의 블로그` }));
  check("US2-8 블로그 이름 링크 44×44px 이상", big(titleLink), `${titleLink.w}×${titleLink.h}`);
  const catLinks = main.getByRole("navigation", { name: "카테고리" }).getByRole("link");
  const catSizes = [];
  for (let i = 0; i < (await catLinks.count()); i++) catSizes.push(await size(catLinks.nth(i)));
  check("US2-8 카테고리 링크 44×44px 이상", catSizes.length >= 2 && catSizes.every(big), catSizes.map((b) => `${b.w}×${b.h}`).join(" "));
  await p.screenshot({ path: `${outDir}/bh-04-owner-375.png`, fullPage: true });

  const ctx2 = await browser.newContext({ ...phone, storageState: await oth.ctx.storageState() });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/@${OTHER}`);
  const first = await size(p2.getByRole("link", { name: "첫 글 쓰기" }));
  check("US2-8 [첫 글 쓰기] 44×44px 이상", big(first), `${first.w}×${first.h}`);
  const overflow2 = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("US2-8 375px 빈 블로그 가로 스크롤 0", overflow2 <= 0, `${overflow2}px`);
  await p2.screenshot({ path: `${outDir}/bh-05-empty-375.png`, fullPage: true });
  await ctx.close();
  await ctx2.close();
}

// US2-9 이상한 쿼리 값 → 200, 전체 글 1페이지
for (const q of ["category=1.5", "category=Infinity", "page=99999999999999999999", "sub=abc"]) {
  const res = await guest.page.goto(`${BASE}/@${OWNER}?${q}`);
  const heading = (await guest.page.locator("main h2").filter({ hasText: "개" }).first().innerText()).replace(/\s+/g, " ");
  const cards = await guest.page.locator("main article").count();
  check(`US2-9 ?${q} → 200 전체 글 1페이지`, res.status() === 200 && heading === "전체 글 10개" && cards === 8, `HTTP ${res.status()}, ${heading}, 카드 ${cards}`);
}

// 일부러 연 404 주소(US2-2)의 "Failed to load resource: 404"는 오류로 보지 않는다
const errors = allErrors.flat().filter((e) => !e.includes("status of 404"));
check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
