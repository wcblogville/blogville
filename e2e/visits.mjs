// 블로그 방문자 수 (BLOG-06): 같은 사람(쿠키)은 하루 1번, 주인은 세지 않는다
// 사용: 개발 서버를 띄운 상태에서 node e2e/blog.mjs 를 한 번 돌린 뒤 (tester1 블로그 필요) node e2e/visits.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const { id: blogId } = (await db.query("SELECT id FROM blogs WHERE slug = 'tester1'")).rows[0];
const dbStats = async () =>
  (
    await db.query(
      "SELECT count(*) FILTER (WHERE date = (now() AT TIME ZONE 'Asia/Seoul')::date)::int AS today, count(*)::int AS total FROM blog_visits WHERE blog_id = $1",
      [blogId],
    )
  ).rows[0];

const browser = await chromium.launch();
/** 화면의 `오늘 방문 N · 전체 방문 N`을 읽는다 (숫자가 바뀔 때까지 잠깐 기다린다) */
const shown = async (page) => {
  const text = await page.getByText(/오늘 방문 [\d,]+ · 전체 방문 [\d,]+/).innerText();
  const [, today, total] = text.match(/오늘 방문 ([\d,]+) · 전체 방문 ([\d,]+)/);
  return { today: Number(today.replace(/,/g, "")), total: Number(total.replace(/,/g, "")) };
};
const settle = (page) => page.waitForLoadState("networkidle").then(() => page.waitForTimeout(400));

// ── 처음 온 방문자 A (로그인 안 함) ──
const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = collectErrors(a);
const before = await dbStats();
const actionReq = a.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
const actionRes = a.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
await a.goto(`${BASE}/@tester1`);
const req = await actionReq;
const res = await actionRes;
await settle(a);
const afterA = await shown(a);
check("처음 온 방문자: 오늘·전체가 1씩 오르고 새로고침 없이 보임", afterA.today === before.today + 1 && afterA.total === before.total + 1, `${JSON.stringify(before)} → ${JSON.stringify(afterA)}`);
const setCookie = (await res.headersArray()).filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value).find((v) => v.startsWith("bv_visitor="));
check(
  "방문자 쿠키: HttpOnly·SameSite=Lax·1년·UUID",
  !!setCookie && /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie) && /Max-Age=31536000/.test(setCookie) &&
    /^bv_visitor=[0-9a-f-]{36};/.test(setCookie),
  setCookie ?? "없음",
);
await a.screenshot({ path: `${outDir}/visits-blog.png`, clip: { x: 0, y: 0, width: 1280, height: 520 } });

// 같은 사람: 새로고침, 카테고리·페이지 이동
await a.reload();
await settle(a);
await a.goto(`${BASE}/@tester1?page=2`);
await settle(a);
const cat = (await db.query("SELECT id FROM categories WHERE blog_id = $1 LIMIT 1", [blogId])).rows[0];
if (cat) {
  await a.goto(`${BASE}/@tester1?category=${cat.id}`);
  await settle(a);
}
const sameA = await dbStats();
check("같은 사람이 새로고침·페이지·카테고리 이동해도 그대로", sameA.today === afterA.today && sameA.total === afterA.total, JSON.stringify(sameA));

// ── 다른 브라우저(쿠키가 다른 사람) B ──
const b = await (await browser.newContext()).newPage();
await b.goto(`${BASE}/@tester1`);
await settle(b);
const afterB = await shown(b);
check("다른 브라우저로 열면 1 오름", afterB.today === afterA.today + 1 && afterB.total === afterA.total + 1, JSON.stringify(afterB));

// ── 블로그 주인 tester1 ──
const ownerCtx = await browser.newContext();
const owner = await ownerCtx.newPage();
await loginDev(owner, "tester1");
await owner.goto(`${BASE}/@tester1`);
await settle(owner);
const ownerSeen = await shown(owner);
const afterOwner = await dbStats();
check("주인이 열면 오르지 않고 같은 숫자가 보임", afterOwner.total === afterB.total && ownerSeen.total === afterB.total, JSON.stringify(ownerSeen));
// 주인이 기록 요청을 직접 보내도 세지 않는다 (방문자 A가 보낸 요청을 주인 쿠키로 다시 보냄)
const replay = await owner.evaluate(
  async ({ actionId, contentType, body }) =>
    (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType }, body })).status,
  { actionId: req.headers()["next-action"], contentType: req.headers()["content-type"], body: req.postData() },
);
check("주인이 recordBlogVisit을 직접 불러도 기록 안 됨", replay === 200 && (await dbStats()).total === afterB.total, `HTTP ${replay}`);
// 없는 블로그 ID로 조작해도 기록 없음
const bogus = await a.evaluate(
  async ({ actionId, contentType }) =>
    (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType }, body: "[2147483000]" })).status,
  { actionId: req.headers()["next-action"], contentType: req.headers()["content-type"] },
);
check("없는 블로그 ID로 조작해도 기록 없음", bogus === 200 && (await dbStats()).total === afterB.total, `HTTP ${bogus}`);

// ── 자바스크립트를 실행하지 않는 요청(curl 같은 GET)으로는 오르지 않는다 ──
await fetch(`${BASE}/@tester1`).then((r) => r.text());
await fetch(`${BASE}/@tester1`).then((r) => r.text());
check("자바스크립트 없는 GET으로는 오르지 않음", (await dbStats()).total === afterB.total);

// ── DB가 같은 (blog_id, date, visitor_id) 두 번째 줄을 거부 ──
const dup = await db
  .query("INSERT INTO blog_visits (blog_id, date, visitor_id) SELECT blog_id, date, visitor_id FROM blog_visits WHERE blog_id = $1 LIMIT 1", [blogId])
  .then(() => "들어감")
  .catch((e) => e.code);
check("같은 사람·같은 날 두 번째 줄은 DB가 거부", dup === "23505", dup);

// ── 375px ──
await a.setViewportSize({ width: 375, height: 800 });
await a.goto(`${BASE}/@tester1`);
await settle(a);
const overflow = await a.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375px: 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
await a.screenshot({ path: `${outDir}/visits-375.png`, clip: { x: 0, y: 0, width: 375, height: 560 } });

check("화면 오류 없음", errors.length === 0, errors.join(" / "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
