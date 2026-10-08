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
  // 소분류 거르기 (BLOG-05 / FR-057, T059)
  ["/@tester1?sub=abc", 200],
  ["/@tester1?sub=1.5", 200],
  ["/@tester1?sub=99999999999", 200],
  ["/@tester1?sub=1&category=abc", 200],
  [`/@tester1?q=${"가".repeat(60)}`, 200],
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
await page.getByLabel("대분류").evaluate((s, v) => {
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
  return { actionId: r.headers()["next-action"], contentType: r.headers()["content-type"], args: r.headers()["content-type"]?.startsWith("multipart/") ? null : JSON.parse(r.postData()) }; // 폼 요청(multipart)은 인자를 읽지 않는다
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
await page.getByRole("button", { name: "추가", exact: true }).last().click();
await page.getByText(tempName).waitFor();
const move = await capture(() => page.getByRole("button", { name: `${tempName} 위로` }).click());
await page.getByRole("button", { name: `${tempName} 아래로` }).click();
await page.waitForLoadState("networkidle");
check("카테고리 순서: 범위 밖 ID → 오류 없음", (await replay(move, [HUGE, -1])) === 200);
check("카테고리 순서: 이상한 방향 값 → 오류 없음", (await replay(move, [move.args[0], "x"])) === 200);
await page.locator("li", { hasText: tempName }).getByRole("button", { name: "이름 바꾸기" }).click();
const editingRow = page.locator("li", { has: page.getByLabel("카테고리 이름", { exact: true }) }); // 고치는 동안 이름은 입력칸 안에 있다
const rename = await capture(() => editingRow.getByRole("button", { name: "저장" }).click());
check("카테고리 이름: 범위 밖 ID → 오류 없음", (await replay(rename, [HUGE, "새 이름"])) === 200);
const del = await capture(() => page.locator("li", { hasText: tempName }).getByRole("button", { name: "삭제" }).click());
check("카테고리 삭제: 범위 밖 ID → 오류 없음", (await replay(del, [HUGE])) === 200);

// 소분류 4개 (BLOG-05 / FR-042, T059): 임시 대분류·소분류를 만들어 요청을 잡고 이상한 ID로 다시 보낸다
{
  await page.goto(`${BASE}/settings/blog`);
  const catName = `소임시${Date.now() % 100000}`;
  await page.getByLabel("새 카테고리 이름").fill(catName);
  await page.getByRole("button", { name: "추가", exact: true }).last().click();
  await page.getByRole("button", { name: `${catName} 위로`, exact: true }).waitFor();
  const row = page.locator("main li", { has: page.getByRole("button", { name: `${catName} 위로`, exact: true }) }).first();
  await row.getByRole("button", { name: "소분류 추가" }).click();
  const addSub = await capture(async () => {
    await row.getByLabel("새 소분류 이름").fill("소1");
    await row.getByRole("button", { name: "추가", exact: true }).click();
  });
  await row.getByLabel("새 소분류 이름").fill("소2");
  await row.getByRole("button", { name: "추가", exact: true }).click();
  await row.getByRole("button", { name: "소2 위로", exact: true }).waitFor();
  const moveSub = await capture(() => row.getByRole("button", { name: "소2 위로", exact: true }).click());
  await row.locator("li", { hasText: "소1" }).getByRole("button", { name: "이름 바꾸기" }).click();
  const renameSub = await capture(() => row.locator("li", { has: page.getByLabel("소분류 이름", { exact: true }) }).getByRole("button", { name: "저장" }).click());
  const delSub = await capture(() => row.locator("li", { hasText: "소2" }).getByRole("button", { name: "삭제" }).click());
  // networkidle은 이미 지난 상태면 바로 끝나므로, 진짜 삭제가 화면에 반영될 때까지 기다린 뒤 센다
  await row.getByRole("button", { name: "소2 위로", exact: true }).waitFor({ state: "detached" });
  const subsBefore = (await one("SELECT count(*)::int AS n FROM subcategories")).n;
  for (const v of [HUGE, "abc", 1.5]) {
    check(`소분류 순서: ${JSON.stringify(v)} → 오류 없음`, (await replay(moveSub, [v, -1])) === 200);
    check(`소분류 이름: ${JSON.stringify(v)} → 오류 없음`, (await replay(renameSub, [v, "새 이름"])) === 200);
    check(`소분류 삭제: ${JSON.stringify(v)} → 오류 없음`, (await replay(delSub, [v])) === 200);
    // 소분류 추가는 폼 칸 "0"에 [묶은 대분류 ID, 이전 상태, "$K1"]가 들어간다
    const status = await page.evaluate(
      async ({ id, v }) => {
        const fd = new FormData();
        fd.append("_1_name", "조작");
        fd.append("0", JSON.stringify([v, {}, "$K1"]));
        return (await fetch(location.href, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: fd })).status;
      },
      { id: addSub.actionId, v },
    );
    check(`소분류 추가: 대분류 ${JSON.stringify(v)} → 오류 없음`, status === 200);
  }
  check("소분류 순서: 이상한 방향 값 → 오류 없음", (await replay(moveSub, [moveSub.args[0], "x"])) === 200);
  const subsAfter = (await one("SELECT count(*)::int AS n FROM subcategories")).n;
  check("소분류 조작 요청 뒤 소분류 수 그대로", subsAfter === subsBefore, `${subsBefore} → ${subsAfter}`);
  // 정리
  await row.getByRole("button", { name: "삭제" }).first().click();
  await page.waitForLoadState("networkidle");
}

// 전시 동물 (BLOG-04 / FR-031, T046): 다 키운 동물을 잠깐 넣어 [전시하기] 요청을 잡고 이상한 값으로 다시 보낸다
{
  const me = await one("SELECT u.id, b.id AS blog_id FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = 'tester1'");
  const animal = await one(
    "INSERT INTO user_animals (user_id, species_id, status, source, hatched_at, grown_at) VALUES ($1, (SELECT min(id) FROM animal_species), 'grown', 'shop', now(), now()) RETURNING id",
    [me.id],
  );
  await page.goto(`${BASE}/@tester1`);
  const show = await capture(() => page.locator("[data-animal-card]").first().getByRole("button", { name: "전시하기" }).click());
  const now = async () => (await one("SELECT showcase_animal_id AS id FROM blogs WHERE id = $1", [me.blog_id])).id;
  const before = await now();
  for (const v of [undefined, "abc", 1.5, HUGE]) {
    const status = await replay(show, v === undefined ? [] : [v]);
    check(`전시 동물: ${v === undefined ? "undefined" : JSON.stringify(v)} → 오류 없음·그대로`, status === 200 && (await now()) === before, `HTTP ${status}`);
  }
  await db.query("DELETE FROM user_animals WHERE id = $1", [animal.id]); // FK가 전시 칸을 비운다
  check("전시 동물: 동물을 지우면 전시 칸이 비워짐", (await now()) === null);
}

// 블로그 주소 (BLOG-03, updateBlogSlug): 이상한 문자열·남의 값을 섞어 보내도 500 없이 문구, tester1 주소는 그대로
{
  const tester2 = await one("SELECT u.id, b.id AS blog_id FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = 'tester2'");
  const slugMsg = async (value, extra) => {
    await page.goto(`${BASE}/settings/blog`);
    const form = page.locator("form", { has: page.getByLabel("블로그 주소") });
    await form.evaluate((f, extra) => {
      f.querySelectorAll("input").forEach((i) => (i.removeAttribute("maxLength"), i.removeAttribute("required")));
      for (const [name, v] of Object.entries(extra ?? {})) {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = name;
        i.value = v;
        f.append(i);
      }
    }, extra);
    await form.getByLabel("블로그 주소").fill(value);
    await form.getByRole("button", { name: "주소 바꾸기" }).click();
    const res = form.locator('[role="alert"], [role="status"]').first();
    return res.waitFor({ timeout: 10000 }).then(() => res.innerText(), () => "(결과 없음)");
  };
  const FORMAT = "주소는 영문 소문자, 숫자, _ 로 3~20자예요";
  for (const [value, want] of [
    ["../admin", FORMAT],
    ["a".repeat(5000), FORMAT],
    ["%00", FORMAT],
    ["<script>", FORMAT],
    ["ｔｅｓｔｅｒ１", FORMAT],
    ["", FORMAT],
    [" TESTER1 ", "저장했어요 ✓"], // 지금 주소와 같음 → 저장 없이 성공
  ]) {
    const got = await slugMsg(value);
    check(`블로그 주소: ${JSON.stringify(value.length > 20 ? `${value.slice(0, 10)}…(${value.length}자)` : value)} → '${want}'`, got === want, got);
  }
  if (tester2) {
    const got = await slugMsg("tester2", { ownerId: tester2.id, blogId: String(tester2.blog_id) });
    check("블로그 주소: 남의 ownerId·blogId를 섞고 남의 주소 → '이미 있는 주소예요'", got === "이미 있는 주소예요", got);
  }
  const slugNow = (await one("SELECT b.slug FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = 'tester1'")).slug;
  const t2Now = tester2 ? (await one("SELECT slug FROM blogs WHERE id = $1", [tester2.blog_id])).slug : "tester2";
  check("블로그 주소: 조작 요청 뒤 tester1·tester2 주소 그대로", slugNow === "tester1" && t2Now === "tester2", `${slugNow}, ${t2Now}`);
}
await page.screenshot({ path: `${outDir}/70-params.png` });

console.log(results.join("\n"));
const serverErrors = errors.filter((e) => e.includes("500"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌")) || serverErrors.length) process.exit(1);
