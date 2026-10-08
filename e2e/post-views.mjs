// 글 조회수: 같은 브라우저는 글마다 한국 시간 하루 1번 (POST-06 / US7, SC-012, quickstart §4)
// 사용: 개발 서버를 띄운 상태에서 node e2e/post-views.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const ctxA = await browser.newContext();
const ctxV = await browser.newContext();
const a = await ctxA.newPage();
const v = await ctxV.newPage();
const errors = collectErrors(v);
const n = Date.now() % 100_000_000;
const idA = `pva${n}`;
await loginDev(a, idA);
const blog = await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [idA]);
const newPost = async (title, visibility = "public") =>
  (
    await one(
      "INSERT INTO posts (blog_id, title, content_html, content_text, visibility, updated_at) VALUES ($1, $2, '<p>x</p>', 'x', $3, '2026-01-01T00:00:00Z') RETURNING id",
      [blog.id, title, visibility],
    )
  ).id;
const postA = await newPost("조회 글 A");
const postB = await newPost("조회 글 B");
const secret = await newPost("비공개", "private");
const stored = async (id) => (await one("SELECT view_count, updated_at FROM posts WHERE id = $1", [id]));
const shown = async (page) => Number((await page.getByText(/^👀 \d+$/).innerText()).replace(/\D/g, ""));

/** 글 상세를 열고 기록 요청이 끝날 때까지 기다린다 */
async function open(page, id) {
  await page.goto(`${BASE}/@${idA}/${id}`);
  await page.waitForLoadState("networkidle");
}

// US7-1 처음 열면 +1, 화면에도 반영
await open(v, postA);
check("US7-1 처음 열면 저장값 +1", (await stored(postA)).view_count === 1);
check("US7-1 화면 👀 1", (await shown(v)) === 1);
check("US7-4 updated_at 그대로", (await stored(postA)).updated_at.toISOString() === "2026-01-01T00:00:00.000Z");
// US7-6 새로고침·다른 탭 → 안 오름 (SC-012: 10번)
for (let i = 0; i < 9; i++) await open(v, postA);
const tab = await ctxV.newPage();
await open(tab, postA);
check("SC-012 같은 브라우저 10번 + 다른 탭 → +1만", (await stored(postA)).view_count === 1);
check("US7-6 다시 열어도 화면 👀 1", (await shown(tab)) === 1);
// US7-5 공감 뒤 다시 그려도 안 오름 (방문자는 공감 못 하므로 다른 회원으로)
const ctxM = await browser.newContext();
const m = await ctxM.newPage();
await loginDev(m, `pvm${n}`);
await open(m, postA);
check("다른 회원 첫 조회 +1", (await stored(postA)).view_count === 2);
await m.getByRole("button", { name: /♥|공감/ }).first().click();
await m.waitForLoadState("networkidle");
await m.locator("textarea").first().fill("잘 봤어요");
await m.getByRole("button", { name: "댓글 등록" }).click();
await m.waitForLoadState("networkidle");
await m.waitForTimeout(500);
check("US7-5 공감·댓글 뒤 안 오름", (await stored(postA)).view_count === 2, String((await stored(postA)).view_count));
// US7-2 주인은 안 오름
await open(a, postA);
check("US7-2 주인이 열면 안 오름", (await stored(postA)).view_count === 2);
check("US7-2 주인 화면은 저장값", (await shown(a)) === 2);
// US7-3 404 경우 안 오름
await open(v, secret);
check("US7-3 비공개 글(404)은 안 오름", (await stored(secret)).view_count === 0);
// US7-8 글 A·B 따로
await open(v, postB);
check("US7-8 글 B는 따로 +1", (await stored(postB)).view_count === 1 && (await stored(postA)).view_count === 2);
// US7-7 날짜가 바뀌면(기록을 어제로) 다시 +1
await db.query("UPDATE post_views SET date = date - 1 WHERE post_id = $1", [postA]);
await open(v, postA);
check("US7-7 다음 날 다시 +1", (await stored(postA)).view_count === 3);
// 조회 기록에 IP·회원 ID 칸 없음
const cols = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'post_views' ORDER BY ordinal_position")).rows.map((r) => r.column_name);
check("post_views 칸: 글·날짜·방문자·시각뿐", cols.join() === "post_id,date,visitor_id,created_at", cols.join());
await v.screenshot({ path: `${outDir}/post-views.png` });

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
