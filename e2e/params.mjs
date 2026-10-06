// 주소·요청의 숫자 값이 이상해도 500 오류가 나지 않는다 (#21: BLOG-02, POST-03, POST-05, 블로그 홈 화면)
// 사용: 개발 서버를 띄운 상태에서 node e2e/blog.mjs 를 한 번 돌린 뒤 (tester1 블로그·글 필요) node e2e/params.mjs <스크린샷 폴더>
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
const HUGE = 99999999999; // integer 범위(2,147,483,647) 밖

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
await loginDev(page, "tester1");
const post = await one(
  "SELECT p.id FROM posts p JOIN blogs b ON b.id = p.blog_id WHERE b.slug = 'tester1' AND p.visibility = 'public' ORDER BY p.id DESC LIMIT 1",
);

// ── 주소: 500 대신 404 또는 기본값 ──
const status = async (path) => (await page.request.get(`${BASE}${path}`)).status();
for (const [path, want] of [
  ["/@tester1/2147483648", 404],
  ["/@tester1/1e3", 404],
  ["/write/2147483648", 404],
  ["/@tester1?category=1.5", 200],
  ["/@tester1?category=Infinity", 200],
  ["/@tester1?category=99999999999", 200],
  ["/@tester1?page=99999999999999999999", 200],
  ["/feed?page=99999999999999999999", 200],
  ["/feed?page=1e300", 200],
  ["/feed/following?page=99999999999999999999", 200],
  [`/tags/${encodeURIComponent("git")}?page=99999999999999999999`, 200],
  ["/wallet?page=99999999999999999999", 200],
]) {
  const got = await status(path);
  check(`주소 ${path} → ${want}`, got === want, `HTTP ${got}`);
}

// ── 폼으로 보내는 숫자: 화면의 값을 범위 밖으로 바꿔 보낸다 ──
await page.goto(`${BASE}/write`);
await page.locator(".ProseMirror").waitFor();
await page.getByPlaceholder("제목").fill("범위 밖 카테고리");
await page.locator(".ProseMirror").click();
await page.keyboard.type("본문");
await page.getByLabel("카테고리").evaluate((s, v) => {
  s.add(new Option("조작", String(v)));
  s.value = String(v);
}, HUGE);
await page.getByRole("button", { name: "발행하기" }).click();
const writeError = await page.getByText("잘못된 요청이에요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
check("글 저장: 범위 밖 카테고리 ID → '잘못된 요청이에요'", writeError && page.url().endsWith("/write"));

await page.goto(`${BASE}/@tester1/${post.id}`);
const commentsBefore = (await one("SELECT count(*)::int AS n FROM comments")).n;
await page.locator('form:has(textarea) input[name="postId"]').evaluate((i, v) => (i.value = String(v)), HUGE);
await page.locator("form textarea").first().fill("범위 밖 글에 댓글");
await page.getByRole("button", { name: "댓글 등록" }).click();
const commentError = await page.getByText("잘못된 요청이에요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
check("댓글: 범위 밖 글 ID → '잘못된 요청이에요', 저장 안 됨", commentError && (await one("SELECT count(*)::int AS n FROM comments")).n === commentsBefore);

// ── 인자로 받는 숫자: 진짜 요청을 한 번 잡아 숫자만 바꿔 다시 보낸다 ──
const capture = async (doIt) => {
  const requestP = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await doIt();
  const r = await requestP;
  await page.waitForLoadState("networkidle");
  return { actionId: r.headers()["next-action"], contentType: r.headers()["content-type"], args: JSON.parse(r.postData()) };
};
const replay = (c, args) =>
  page.evaluate(
    async ({ c, body }) =>
      (await fetch(location.href, { method: "POST", headers: { "Next-Action": c.actionId, Accept: "text/x-component", "Content-Type": c.contentType }, body })).status,
    { c, body: JSON.stringify(args) },
  );
page.on("dialog", (d) => d.accept());

// 공감: 눌렀다가 다시 눌러 원래대로
await page.goto(`${BASE}/@tester1/${post.id}`);
const like = await capture(() => page.getByRole("button", { name: /공감/ }).click());
await page.getByRole("button", { name: /공감/ }).click();
await page.waitForLoadState("networkidle");
check("공감: 범위 밖 글 ID → 오류 없음", (await replay(like, [HUGE])) === 200);
check("공감: 숫자가 아닌 글 ID → 오류 없음", (await replay(like, ["abc"])) === 200);

// 댓글 삭제: 지울 댓글을 하나 쓰고 지운다
await page.locator("form textarea").first().fill("지울 댓글");
await page.getByRole("button", { name: "댓글 등록" }).click();
await page.getByText("지울 댓글").first().waitFor();
const delComment = await capture(() => page.getByRole("button", { name: "삭제", exact: true }).last().click());
check("댓글 삭제: 범위 밖 댓글 ID → 오류 없음", (await replay(delComment, [HUGE])) === 200);

// 카테고리: 임시 카테고리를 만들어 이름 바꾸기·순서·삭제 요청을 잡는다
await page.goto(`${BASE}/settings/blog`);
const tempName = `임시${Date.now() % 100000}`;
await page.getByLabel("새 카테고리 이름").fill(tempName);
await page.getByRole("button", { name: "추가" }).click();
await page.getByText(tempName).waitFor();
const move = await capture(() => page.getByRole("button", { name: `${tempName} 위로` }).click());
await page.getByRole("button", { name: `${tempName} 아래로` }).click();
await page.waitForLoadState("networkidle");
check("카테고리 순서: 범위 밖 ID → 오류 없음", (await replay(move, [HUGE, -1])) === 200);
check("카테고리 순서: 이상한 방향 값 → 오류 없음", (await replay(move, [move.args[0], "x"])) === 200);
await page.locator("li", { hasText: tempName }).getByRole("button", { name: "이름 바꾸기" }).click();
const editingRow = page.locator("li", { has: page.getByLabel("카테고리 이름") }); // 고치는 동안 이름은 입력칸 안에 있다
const rename = await capture(() => editingRow.getByRole("button", { name: "저장" }).click());
check("카테고리 이름: 범위 밖 ID → 오류 없음", (await replay(rename, [HUGE, "새 이름"])) === 200);
const del = await capture(() => page.locator("li", { hasText: tempName }).getByRole("button", { name: "삭제" }).click());
check("카테고리 삭제: 범위 밖 ID → 오류 없음", (await replay(del, [HUGE])) === 200);
await page.screenshot({ path: `${outDir}/70-params.png` });

console.log(results.join("\n"));
const serverErrors = errors.filter((e) => e.includes("500"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌")) || serverErrors.length) process.exit(1);
