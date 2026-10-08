// 블로그 규모 성능: 공개 글 1,000개 블로그의 블로그 홈·대분류·소분류 거르기·주인 검색 첫 페이지 (SC-003·011, NF-07, research R-01·R-14·R-16)
// 사용: node e2e/blog-scale.mjs <스크린샷 폴더> [BASE_URL]  — 숫자는 프로덕션 빌드(next build && next start)로 잰다
// 전용 회원 scale01의 블로그에 글 1,000개와 대분류·소분류를 DB로 채운다 (이미 있으면 건너뜀).
// 각 화면을 캐시 없는 새 브라우저 컨텍스트로 5번 열어 load 시간 중앙값을 출력하고 1,000ms 미만을 기대한다.
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const BASE = process.argv[3] ?? "http://localhost:3000";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, args) => (await db.query(q, args)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();

// loginDev는 helpers의 BASE(3000)를 쓴다. 다른 주소면 같은 서버를 3000으로도 띄운다고 가정하지 않고 직접 로그인한다
const login = await browser.newContext();
const lp = await login.newPage();
if (BASE === "http://localhost:3000") await loginDev(lp, "scale01");
else throw new Error("BASE는 http://localhost:3000 만 지원한다 (helpers.loginDev)");
const state = await login.storageState();
await login.close();

const blog = await one("SELECT b.id, b.slug FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = 'scale01'");
let cat = await one("SELECT id FROM categories WHERE blog_id = $1 AND name = '규모 대분류'", [blog.id]);
if (!cat) cat = await one("INSERT INTO categories (blog_id, name, position) VALUES ($1, '규모 대분류', 1) RETURNING id", [blog.id]);
let sub = await one("SELECT id FROM subcategories WHERE category_id = $1", [cat.id]);
if (!sub) sub = await one("INSERT INTO subcategories (category_id, name) VALUES ($1, '규모 소분류') RETURNING id", [cat.id]);
const have = (await one("SELECT count(*)::int AS c FROM posts WHERE blog_id = $1", [blog.id])).c;
const hasSubcolumn = Boolean(await one("SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'subcategory_id'"));
if (have < 1000) {
  // 글 절반은 대분류에 (post 단계 3 뒤면 그중 절반은 소분류에도)
  await db.query(
    `INSERT INTO posts (blog_id, category_id, title, content_html, content_text, created_at)
     SELECT $1, CASE WHEN g % 2 = 0 THEN $2::int END, '규모 시험 글 ' || g, '<p>본문 ' || g || ' 규모검색어</p>', '본문 ' || g || ' 규모검색어',
            now() - make_interval(mins => g)
     FROM generate_series($3::int + 1, 1000) g`,
    [blog.id, cat.id, have],
  );
  if (hasSubcolumn) await db.query("UPDATE posts SET subcategory_id = $2 WHERE blog_id = $1 AND category_id = $3 AND id % 2 = 0", [blog.id, sub.id, cat.id]);
}
const total = (await one("SELECT count(*)::int AS c FROM posts WHERE blog_id = $1 AND visibility = 'public'", [blog.id])).c;
console.log(`블로그 /@${blog.slug} 공개 글 ${total}개${hasSubcolumn ? "" : " (post 단계 3 전: 소분류 거르기는 빈 목록)"}`);

const targets = [
  ["블로그 홈", `/@${blog.slug}`],
  ["대분류 거르기", `/@${blog.slug}?category=${cat.id}`],
  ["소분류 거르기", `/@${blog.slug}?sub=${sub.id}`],
  ["주인 검색 첫 페이지", `/@${blog.slug}?q=${encodeURIComponent("규모검색어")}`],
];
for (const [name, path] of targets) {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const ctx = await browser.newContext({ storageState: state, viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(BASE + path, { waitUntil: "load" });
    times.push(await p.evaluate(() => Math.round(performance.getEntriesByType("navigation")[0].loadEventEnd)));
    if (i === 0) await p.screenshot({ path: `${outDir}/scale-${name.replace(/\s/g, "_")}.png` });
    await ctx.close();
  }
  times.sort((a, b) => a - b);
  check(`${name} load 중앙값 1,000ms 미만`, times[2] < 1000, `${times[2]}ms, 5회 ${times.join("/")}`);
}

console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
