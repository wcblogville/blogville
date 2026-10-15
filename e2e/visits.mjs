// 블로그 방문자 수 (BLOG-06): 같은 사람(쿠키)은 하루 1번, 주인은 세지 않는다. 방문자 기록 (BLOG-10): 주인만 누가 왔는지 본다
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
      "SELECT count(*) FILTER (WHERE date = (now() AT TIME ZONE 'Asia/Seoul')::date)::int AS today, count(*) FILTER (WHERE date = (now() AT TIME ZONE 'Asia/Seoul')::date - 1)::int AS yesterday, count(*)::int AS total FROM blog_visits WHERE blog_id = $1",
      [blogId],
    )
  ).rows[0];

const browser = await chromium.launch();
/** 옆 칸 👣 방문자 위젯의 오늘·어제·전체 숫자를 읽는다 (블로그 홈의 방문 숫자는 위젯 한 곳, 2026-10-11) */
const shown = async (page) => {
  const read = async (label) => Number((await page.locator(`[data-visit="${label}"]`).innerText()).replace(/,/g, ""));
  return { today: await read("오늘"), yesterday: await read("어제"), total: await read("전체") };
};
// 방문 기록(Server Action)이 끝나기를 기다린다. 지금 보는 주소를 미리 받는(prefetch) RSC 응답은 끝나지 않고 열려 있을 때가 있어
// networkidle만 믿지 않고 5초에서 끊는다
const settle = (page) => page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {}).then(() => page.waitForTimeout(400));

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
// 소분류 거르기·검색 주소(?sub=, ?q= — 주인이 아니면 보통 블로그 홈)도 같은 날 다시 세지 않는다 (BLOG-05·검색, T069)
const sub = (await db.query("SELECT s.id FROM subcategories s JOIN categories c ON c.id = s.category_id WHERE c.blog_id = $1 LIMIT 1", [blogId])).rows[0];
for (const q of [`sub=${sub?.id ?? "abc"}`, "q=검색"]) {
  await a.goto(`${BASE}/@tester1?${q}`);
  await settle(a);
}
const sameA = await dbStats();
check("같은 사람이 새로고침·페이지·카테고리·소분류·검색 주소로 이동해도 그대로", sameA.today === afterA.today && sameA.total === afterA.total, JSON.stringify(sameA));

// ── 다른 브라우저(쿠키가 다른 사람) B ──
const b = await (await browser.newContext()).newPage();
await b.goto(`${BASE}/@tester1`);
await settle(b);
const afterB = await shown(b);
check("다른 브라우저로 열면 1 오름", afterB.today === afterA.today + 1 && afterB.total === afterA.total + 1, JSON.stringify(afterB));

// ── 글 상세로 들어온 방문자 C: 상세를 열어도 1 오르고, 이어서 홈을 열어도 더 오르지 않는다 ──
const post = (await db.query("SELECT id FROM posts WHERE blog_id = $1 AND visibility = 'public' ORDER BY id DESC LIMIT 1", [blogId])).rows[0];
const c = await (await browser.newContext()).newPage();
await c.goto(`${BASE}/@tester1/${post.id}`);
await settle(c);
const afterC = await dbStats();
check("글 상세를 연 사람도 방문자로 1 오름", afterC.today === afterB.today + 1 && afterC.total === afterB.total + 1, JSON.stringify(afterC));
await c.goto(`${BASE}/@tester1`);
await settle(c);
check("같은 사람이 이어서 홈을 열어도 더 오르지 않음", (await dbStats()).total === afterC.total && (await shown(c)).total === afterC.total);

// ── 어제 방문: 어제 날짜로 한 줄을 넣고 화면·관리 그래프 확인 (확인 뒤 지운다) ──
await db.query("INSERT INTO blog_visits (blog_id, date, visitor_id) VALUES ($1, (now() AT TIME ZONE 'Asia/Seoul')::date - 1, '00000000-0000-4000-8000-0000000000e2')", [blogId]);
await c.reload();
await settle(c);
const withYesterday = await shown(c);
const dbY = await dbStats();
check("어제 방문이 화면에 보임", withYesterday.yesterday === dbY.yesterday && dbY.yesterday >= 1 && withYesterday.total === dbY.total, JSON.stringify(withYesterday));

// ── 블로그 주인 tester1 ──
const ownerCtx = await browser.newContext();
const owner = await ownerCtx.newPage();
await loginDev(owner, "tester1");
await owner.goto(`${BASE}/@tester1`);
await settle(owner);
const ownerSeen = await shown(owner);
const afterOwner = await dbStats();
check("주인이 열면 오르지 않고 같은 숫자가 보임", afterOwner.total === dbY.total && ownerSeen.total === dbY.total, JSON.stringify(ownerSeen));

// 블로그 관리: 최근 7일 그래프 (마지막 칸 오늘, 숫자는 DB와 같다)
await owner.goto(`${BASE}/settings/blog`);
const bars = await owner.getByRole("list", { name: "최근 7일 방문자 수" }).getByRole("listitem").evaluateAll((lis) => lis.map((li) => li.getAttribute("aria-label")));
check("관리 화면 그래프: 7칸, 마지막은 오늘", bars.length === 7 && bars[6].startsWith("오늘 "), bars.join(" / "));
check("관리 화면 그래프: 오늘·어제 숫자가 DB와 같음", bars[6] === `오늘 ${afterOwner.today}명` && bars[5].endsWith(` ${afterOwner.yesterday}명`), `${bars[5]} / ${bars[6]}`);
await owner.screenshot({ path: `${outDir}/visits-settings.png`, clip: { x: 0, y: 0, width: 1280, height: 520 } });
// 주인이 기록 요청을 직접 보내도 세지 않는다 (방문자 A가 보낸 요청을 주인 쿠키로 다시 보냄)
const replay = await owner.evaluate(
  async ({ actionId, contentType, body }) =>
    (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType }, body })).status,
  { actionId: req.headers()["next-action"], contentType: req.headers()["content-type"], body: req.postData() },
);
check("주인이 recordBlogVisit을 직접 불러도 기록 안 됨", replay === 200 && (await dbStats()).total === dbY.total, `HTTP ${replay}`);
// 없는 블로그 ID로 조작해도 기록 없음
const bogus = await a.evaluate(
  async ({ actionId, contentType }) =>
    (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType }, body: "[2147483000]" })).status,
  { actionId: req.headers()["next-action"], contentType: req.headers()["content-type"] },
);
check("없는 블로그 ID로 조작해도 기록 없음", bogus === 200 && (await dbStats()).total === dbY.total, `HTTP ${bogus}`);

// ── 자바스크립트를 실행하지 않는 요청(curl 같은 GET)으로는 오르지 않는다 ──
await fetch(`${BASE}/@tester1`).then((r) => r.text());
await fetch(`${BASE}/@tester1`).then((r) => r.text());
check("자바스크립트 없는 GET으로는 오르지 않음", (await dbStats()).total === dbY.total);

// ── DB가 같은 (blog_id, date, visitor_id) 두 번째 줄을 거부 ──
const dup = await db
  .query("INSERT INTO blog_visits (blog_id, date, visitor_id) SELECT blog_id, date, visitor_id FROM blog_visits WHERE blog_id = $1 LIMIT 1", [blogId])
  .then(() => "들어감")
  .catch((e) => e.code);
check("같은 사람·같은 날 두 번째 줄은 DB가 거부", dup === "23505", dup);

// ── 방문자 기록 (BLOG-10, 2026-10-12 "방문자기록 볼 수 있으면"): 회원 방문은 누구인지 적고, 주인만 /settings/visitors에서 본다 ──
const M = `vs${Date.now() % 100_000_000}`;
const memberCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const mem = await memberCtx.newPage();
await loginDev(mem, M);
const memberId = (await db.query("SELECT id FROM users WHERE username = $1", [M])).rows[0].id;
await mem.goto(`${BASE}/@tester1`);
await settle(mem);
const memRow = (await db.query("SELECT user_id FROM blog_visits WHERE blog_id = $1 AND user_id = $2", [blogId, memberId])).rows[0];
check("로그인한 회원 방문은 회원 ID와 함께 1줄", !!memRow);
check("다른 사람의 방문자 위젯에는 기록 링크가 없다 (숫자만)", (await mem.locator("[data-visit-log-link]").count()) === 0);
await owner.goto(`${BASE}/@tester1`);
await settle(owner);
check("주인의 방문자 위젯에 '누가 왔는지 보기'", await owner.locator("[data-visit-log-link]").isVisible());
await owner.locator("[data-visit-log-link]").click();
await owner.waitForURL(/\/settings\/visitors$/);
const todayRow = (
  await db.query(
    "SELECT count(*)::int AS total, count(user_id)::int AS members FROM blog_visits WHERE blog_id = $1 AND date = (now() AT TIME ZONE 'Asia/Seoul')::date",
    [blogId],
  )
).rows[0];
check("방문자 기록: 14칸 그래프, 마지막은 오늘", (await owner.locator("[data-visit-chart='14'] li").count()) === 14 && (await owner.locator("[data-visit-chart='14'] li").last().getAttribute("aria-label")).startsWith(`오늘 ${todayRow.total}명 (회원 ${todayRow.members}, 손님 ${todayRow.total - todayRow.members})`));
const memberLine = owner.locator(`[data-visit-member="${M}"]`).first();
check("방문자 기록: 방금 온 회원의 얼굴·닉네임·블로그 링크·시각", (await memberLine.isVisible()) && (await memberLine.locator("img").count()) === 1 && (await memberLine.getByRole("link").getAttribute("href")) === `/@${M}` && /\d{2}:\d{2}/.test(await memberLine.locator("time").innerText()));
const guestsToday = todayRow.total - todayRow.members;
const todayDay = owner.locator("[data-visit-day]").first();
check("방문자 기록: 손님은 날짜마다 '손님 N명'으로 묶음", guestsToday === 0 || (await todayDay.locator(`[data-visit-guests="${guestsToday}"]`).innerText()).includes(`손님 ${guestsToday}명`), `손님 ${guestsToday}`);
check("방문자 기록: 손님 쿠키 값은 화면에 없다", !(await owner.content()).includes("00000000-0000-4000-8000-0000000000e2"));
await owner.screenshot({ path: `${outDir}/visitors-1280.png`, fullPage: true });
await owner.getByRole("link", { name: "30일" }).click();
await owner.waitForURL(/days=30/);
check("기간 30일: 30칸", (await owner.locator("[data-visit-chart='30'] li").count()) === 30);
await owner.screenshot({ path: `${outDir}/visitors-30-1280.png`, fullPage: true });
{
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, storageState: await ownerCtx.storageState() });
  const pp = await phone.newPage();
  await pp.goto(`${BASE}/settings/visitors`);
  const over = await pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("방문자 기록 375px: 가로 스크롤 없음", over <= 0, `${over}px`);
  await pp.screenshot({ path: `${outDir}/visitors-375.png`, fullPage: true });
  await pp.goto(`${BASE}/settings/visitors?days=30`);
  const over30 = await pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("방문자 기록 30일 375px: 가로 스크롤 없음", over30 <= 0, `${over30}px`);
  await pp.screenshot({ path: `${outDir}/visitors-30-375.png`, fullPage: true });
  await phone.close();
}
// 다른 회원이 같은 주소를 열면 자기 블로그 기록만 (tester1의 방문자가 보이지 않는다)
await mem.goto(`${BASE}/settings/visitors`);
check("다른 회원은 자기 블로그 기록만 (tester1 방문 목록 안 보임)", (await mem.locator(`[data-visit-member="${M}"]`).count()) === 0 && (await mem.locator("h1").innerText()).includes("방문자 기록"));
{
  const g = await browser.newContext();
  const gp = await g.newPage();
  await gp.goto(`${BASE}/settings/visitors`);
  check("로그인 안 하면 방문자 기록 대신 첫 화면", new URL(gp.url()).pathname === "/", gp.url());
  await g.close();
}
// 탈퇴하면 그 방문은 손님으로 남는다 (FK ON DELETE SET NULL)
const fk = (await db.query("SELECT confdeltype FROM pg_constraint WHERE conname = 'blog_visits_user_id_users_id_fk'")).rows[0];
check("blog_visits.user_id FK는 ON DELETE SET NULL", fk?.confdeltype === "n");
await memberCtx.close();

// ── 375px ──
await a.setViewportSize({ width: 375, height: 800 });
await a.goto(`${BASE}/@tester1`);
await settle(a);
const overflow = await a.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375px: 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
await a.screenshot({ path: `${outDir}/visits-375.png`, clip: { x: 0, y: 0, width: 375, height: 560 } });

check("화면 오류 없음", errors.length === 0, errors.join(" / "));
await db.query("DELETE FROM blog_visits WHERE visitor_id = '00000000-0000-4000-8000-0000000000e2'");
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
