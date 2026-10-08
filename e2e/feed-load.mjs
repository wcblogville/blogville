// 마을 소식 첫 화면 속도 (SOC-05 / SC-001, NF-07, quickstart 5절)
// 사용: node e2e/feed-load.mjs <스크린샷 폴더> [주소]. 공개 글 1,000개를 SQL로 넣고 잰 뒤 지운다.
// 숫자는 `npm run build && npm run start`로 띄운 서버에서 재야 의미가 있다 (개발 서버는 처음 열 때 컴파일 시간이 들어간다)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE as DEFAULT_BASE, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const BASE = process.argv[3] ?? DEFAULT_BASE;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const n = Date.now() % 100_000_000;

const browser = await chromium.launch();
// 글쓴이 50명(이웃 50명, 그중 10명 즐겨찾기)과 글 1,000개
const reader = await browser.newPage();
await loginDev(reader, `fla${n}`);
const readerId = (await one("SELECT id FROM users WHERE username = $1", [`fla${n}`])).id;
const writers = [];
for (let i = 0; i < 50; i++) {
  const p = await browser.newPage();
  await loginDev(p, `flw${n}x${i}`);
  await p.close();
  writers.push(await one("SELECT u.id, b.id AS blog_id FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = $1", [`flw${n}x${i}`]));
}
await db.query(
  `INSERT INTO posts (blog_id, title, content_html, content_text, created_at, updated_at)
   SELECT (ARRAY[${writers.map((w) => w.blog_id).join(",")}])[1 + (g % 50)], '부하 글 ' || g, '<p>부하</p>', '부하', now() - (g || ' minutes')::interval, now()
   FROM generate_series(1, 1000) g`,
);
await db.query("INSERT INTO follows (follower_id, followee_id, is_favorite) SELECT $1, unnest($2::text[]), false", [readerId, writers.map((w) => w.id)]);
await db.query("UPDATE follows SET is_favorite = true WHERE follower_id = $1 AND followee_id = ANY($2)", [readerId, writers.slice(0, 10).map((w) => w.id)]);

async function measure(path, page) {
  const times = [];
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    await page.goto(`${BASE}${path}`, { waitUntil: "load" });
    times.push(Date.now() - start);
  }
  return times;
}
const guestCtx = await browser.newContext();
const guestTimes = await measure("/feed", await guestCtx.newPage());
const followTimes = await measure("/feed/following", reader);
await reader.screenshot({ path: `${outDir}/feed-load.png` });

console.log(`/feed 첫 화면 load (ms): ${guestTimes.join(", ")} (기대 1000 안)`);
console.log(`/feed/following load (ms): ${followTimes.join(", ")}`);
// 넣은 데이터 지우기 (회원을 지우면 블로그·글·이웃이 함께 지워진다)
await db.query("DELETE FROM users WHERE id = ANY($1)", [[readerId, ...writers.map((w) => w.id)]]);
await db.end();
await browser.close();
const slow = Math.min(...guestTimes) > 1000;
console.log(slow ? "❌ SC-001 1초 넘음" : "✅ SC-001 1초 안");
if (slow) process.exit(1);
