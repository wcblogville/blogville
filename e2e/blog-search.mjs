// 내 블로그에서 마을의 글·블로그 검색 (BLOG 검색 / US6-1~7, FR-050~053, SC-004·008·013, quickstart 3.4)
// 사용: 개발 서버를 띄운 상태에서 node e2e/blog-search.mjs <스크린샷 폴더>
// 실행마다 새 회원과 고유한 검색어(맛집{번호})로 DB에 글을 준비한다.
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
const OWNER = `sr${n}`; // 검색하는 주인
const OTHER = `ss${n}`; // 글을 쓴 다른 회원 (블로그 이름에 검색어)
const THIRD = `st${n}`; // 닉네임에 검색어
const KEY = `맛집${n}`;
const desktop = { viewport: { width: 1280, height: 900 } };
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };

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
const thd = await fresh();
await loginDev(thd.page, THIRD);
const guest = await fresh();
const blogOf = (u) => one("SELECT u.id AS user_id, b.id, b.slug FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = $1", [u]);
const ownerBlog = await blogOf(OWNER);
const otherBlog = await blogOf(OTHER);
const thirdBlog = await blogOf(THIRD);

// 준비: 다른 회원 블로그 이름·셋째 회원 닉네임에 검색어, 공개 글 11개(제목 또는 본문), 비공개 글 2개(남의 것·내 것)
await db.query("UPDATE blogs SET title = $2 WHERE id = $1", [otherBlog.id, `${KEY} 탐방기`]);
await db.query("UPDATE profiles SET nickname = $2 WHERE user_id = $1", [thirdBlog.user_id, `닉${KEY}`]);
const post = (blogId, title, text, minsAgo, visibility = "public") =>
  db.query(
    "INSERT INTO posts (blog_id, title, content_html, content_text, visibility, created_at) VALUES ($1, $2, $3, $3, $4, now() - make_interval(mins => $5))",
    [blogId, title, text, visibility, minsAgo],
  );
for (let i = 1; i <= 10; i++) {
  // 홀수는 제목에, 짝수는 본문에 검색어. i가 클수록 최근
  await post(otherBlog.id, i % 2 ? `${KEY} 후기 ${i}` : `동네 이야기 ${i}`, i % 2 ? "본문" : `오늘 간 곳은 ${KEY} 이었다`, 100 - i);
}
await post(ownerBlog.id, "내 공개 글", `여기도 ${KEY}`, 50);
await post(otherBlog.id, `${KEY} 남의 비밀`, "비밀", 1, "private");
await post(ownerBlog.id, `${KEY} 내 비밀`, "비밀", 1, "private");
await post(otherBlog.id, `세일 ${n}%`, "x", 300);
await post(otherBlog.id, `세일 ${n}x`, "x", 300);
await post(otherBlog.id, `밑줄 ${n}_a`, "x", 300);
await post(otherBlog.id, `밑줄 ${n}b`, "x", 300);

const page = own.page;
const titles = () => page.locator("main article h3").allInnerTexts();

// US6-1 검색창으로 검색 → 마을 전체 공개 글 중 제목·본문 일치, 최신순 8개, 2페이지, 카드 윗줄 `{닉네임} · {블로그 이름}`
{
  await page.goto(`${BASE}/@${OWNER}`);
  const box = page.getByRole("search");
  const input = box.getByLabel("검색어");
  check("US6-1 주인 블로그 홈에 검색창 (maxLength 50, 안내 문구)", (await input.getAttribute("maxlength")) === "50" && (await input.getAttribute("placeholder")) === "마을의 글·블로그 검색");
  const btn = await box.getByRole("button", { name: "검색" }).boundingBox();
  check("US6-1 [검색] 44×44px 이상", btn.width >= 44 && btn.height >= 44, `${Math.round(btn.width)}×${Math.round(btn.height)}`);
  await input.fill(KEY);
  await box.getByRole("button", { name: "검색" }).click();
  await page.waitForURL(/\?q=/);
  await page.getByRole("heading", { name: `🔍 '${KEY}' 검색 결과` }).waitFor();
  const url = new URL(page.url());
  check("US6-1 GET 주소 /@{내 주소}?q=검색어", url.pathname === `/@${OWNER}` && url.searchParams.get("q") === KEY, page.url());
  const t1 = await titles();
  const postsHeading = await page.getByRole("heading", { name: /^글 \d+개$/ }).innerText();
  check("US6-1 공개 글만 11개", postsHeading === "글 11개", postsHeading);
  const expected = ["내 공개 글", ...[10, 9, 8, 7, 6, 5, 4].map((i) => (i % 2 ? `${KEY} 후기 ${i}` : `동네 이야기 ${i}`))];
  check("US6-1 1페이지 8개, 최신순 (제목·본문 일치)", JSON.stringify(t1) === JSON.stringify(expected), t1.join(" | "));
  const author = (await page.locator("main article").nth(1).locator("a").first().innerText()).replace(/\s+/g, " ").trim();
  check("US6-1 카드 윗줄 `{닉네임} · {블로그 이름}`", author === `${OTHER} · ${KEY} 탐방기`, author);
  await page.screenshot({ path: `${outDir}/bs-01-results.png`, fullPage: true });
  const next = page.getByRole("navigation", { name: "페이지" }).getByRole("link", { name: "2" });
  const href = await next.getAttribute("href");
  await next.click();
  await page.waitForURL(/page=2/);
  const t2 = await titles();
  check("US6-1 2페이지 링크가 q 유지, 3개", new URL(href, BASE).searchParams.get("q") === KEY && t2.length === 3, `${href} / ${t2.length}개`);
  check("US6-1 2페이지에는 블로그 묶음 없음", (await page.getByRole("heading", { name: "블로그", exact: true }).count()) === 0);
  check("US6-3 남의 비공개 글·내 비공개 글은 결과에 없음", ![...t1, ...t2].some((t) => t.includes("비밀")));
  check("US6-3 내 공개 글은 결과에 있음", [...t1, ...t2].includes("내 공개 글"));
  check("US6-1 검색 모드: 카테고리 트리에 선택 표시 없음", (await page.getByRole("navigation", { name: "카테고리" }).locator('[aria-current="page"]').count()) === 0);
}

// US6-2 블로그 묶음: 블로그 이름·닉네임 일치, 누르면 그 블로그 홈
{
  await page.goto(`${BASE}/@${OWNER}?q=${encodeURIComponent(KEY)}`);
  const group = page.locator('section[aria-labelledby="found-blogs"]');
  const rows = (await group.getByRole("link").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("US6-2 블로그 이름 일치 블로그", rows.some((r) => r.startsWith(`${OTHER} · ${KEY} 탐방기`) && r.endsWith(`@${OTHER}`)), rows.join(" | "));
  check("US6-2 닉네임 일치 블로그", rows.some((r) => r.startsWith(`닉${KEY} · ${THIRD}의 블로그`)), rows.join(" | "));
  check("US6-2 최대 8곳·일치하지 않는 블로그 없음", rows.length === 2, `${rows.length}곳`);
  check("US6-2 최근 공개 글 순 (글 있는 블로그 먼저)", rows[0]?.startsWith(OTHER), rows[0]);
  await group.getByRole("link", { name: new RegExp(`닉${KEY}`) }).click();
  await page.waitForURL(`${BASE}/@${THIRD}`);
  check("US6-2 누르면 그 블로그 홈", new URL(page.url()).pathname === `/@${THIRD}`);
}

// US6-4 결과 없음·공백만
{
  await page.goto(`${BASE}/@${OWNER}?q=${encodeURIComponent(`없는말${n}`)}`);
  check("US6-4 없는 검색어 → `검색 결과가 없어요`", await page.getByText("검색 결과가 없어요").isVisible());
  await page.goto(`${BASE}/@${OWNER}`);
  await page.getByRole("search").getByLabel("검색어").fill("   ");
  await page.getByRole("search").getByRole("button", { name: "검색" }).click();
  await page.waitForURL(/\?q=/);
  await page.getByText("검색어를 적어 주세요").waitFor({ timeout: 10000 }).catch(() => {});
  check("US6-4 공백만 → `검색어를 적어 주세요`", await page.getByText("검색어를 적어 주세요").isVisible());
}

// %, _ 는 그 글자 그대로
{
  await page.goto(`${BASE}/@${OWNER}?q=${encodeURIComponent(`${n}%`)}`);
  const pct = await titles();
  check("FR-051 `%` 검색어 → 그 글자가 든 글만", pct.length === 1 && pct[0] === `세일 ${n}%`, pct.join(" | "));
  await page.goto(`${BASE}/@${OWNER}?q=${encodeURIComponent(`${n}_`)}`);
  const und = await titles();
  check("FR-051 `_` 검색어 → 그 글자가 든 글만", und.length === 1 && und[0] === `밑줄 ${n}_a`, und.join(" | "));
  await page.goto(`${BASE}/@${OWNER}?q=${encodeURIComponent("가".repeat(51))}`);
  check("FR-053 51자 검색어 → 무시하고 보통 블로그 홈", (await page.getByText("검색 결과").count()) === 0 && (await page.locator("main h2").filter({ hasText: /^전체 글/ }).count()) === 1);
}

// US6-5 광장(데스크톱·휴대폰)·마을 소식에 검색창 없음
{
  const noSearch = async (p, path) => {
    await p.goto(`${BASE}${path}`);
    await p.waitForLoadState("networkidle");
    return (await p.getByRole("search").count()) === 0 && (await p.getByLabel("검색어").count()) === 0;
  };
  check("US6-5 /town 데스크톱 검색창 없음", await noSearch(page, "/town"));
  check("US6-5 /feed 검색창 없음", await noSearch(page, "/feed"));
  const m = await fresh(phone, await own.ctx.storageState());
  check("US6-5 /town 휴대폰 검색창 없음", await noSearch(m.page, "/town"));
  await m.ctx.close();
}

// US6-6 방문자: 검색창 없음, ?q= → 보통 블로그 홈 / US6-7 회원: 남의 블로그 없음, 자기 블로그 있음
{
  const g = guest.page;
  await g.goto(`${BASE}/@${OWNER}`);
  check("US6-6 방문자 블로그 홈 검색창 없음", (await g.getByRole("search").count()) === 0);
  await g.goto(`${BASE}/@${OWNER}?q=${encodeURIComponent(KEY)}`);
  const heading = (await g.locator("main h2").filter({ hasText: "개" }).first().innerText()).replace(/\s+/g, " ");
  check("US6-6 방문자 /@{주소}?q= → 보통 블로그 홈, 결과 없음", (await g.getByText("검색 결과").count()) === 0 && heading === "전체 글 1개", heading);
  await oth.page.goto(`${BASE}/@${OWNER}?q=${encodeURIComponent(KEY)}`);
  check("US6-7 회원이 남의 블로그 → 검색창·결과 없음", (await oth.page.getByRole("search").count()) === 0 && (await oth.page.getByText("검색 결과").count()) === 0);
  await oth.page.goto(`${BASE}/@${OTHER}`);
  check("US6-7 회원이 자기 블로그 → 검색창 있음", (await oth.page.getByRole("search").count()) === 1);
}

// SC-004 375px 검색 결과 가로 스크롤 0
{
  const m = await fresh(phone, await own.ctx.storageState());
  await m.page.goto(`${BASE}/@${OWNER}?q=${encodeURIComponent(KEY)}`);
  const overflow = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("SC-004 375px 검색 결과 가로 스크롤 0", overflow <= 0, `${overflow}px`);
  await m.page.screenshot({ path: `${outDir}/bs-02-results-375.png`, fullPage: true });
  await m.page.goto(`${BASE}/@${OWNER}?q=${encodeURIComponent(`없는말${n}`)}`);
  await m.page.screenshot({ path: `${outDir}/bs-03-empty-375.png`, fullPage: true });
  await m.ctx.close();
}

const errors = allErrors.flat();
check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
