// 글쓰기·수정·삭제·공개 범위 (POST-01·POST-02, GAME-05 / US1·US2·US3, quickstart §4)
// 사용: 개발 서버를 띄운 상태에서 node e2e/post-write.mjs <스크린샷 폴더>
// 하루 보상 횟수에 걸리지 않게 실행할 때마다 새 회원 A·B를 만든다
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
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const ctxGuest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctxA.newPage();
const b = await ctxB.newPage();
const guest = await ctxGuest.newPage();
const errors = collectErrors(a);
const n = Date.now() % 100_000_000;
const idA = `pwa${n}`;
const idB = `pwb${n}`;
await loginDev(a, idA);
await loginDev(b, idB);
const userA = (await one("SELECT id FROM users WHERE username = $1", [idA])).id;

const status = (page) => page.locator("p", { hasText: /\d+자 ·/ }).innerText();
const postIdOf = (page) => Number(new URL(page.url()).pathname.match(/\/(\d+)$/)[1]);

async function openWrite(page) {
  await page.goto(`${BASE}/write`);
  await page.locator(".ProseMirror").waitFor();
}

/** 새 글 발행 → 글 상세 주소의 글 번호 */
async function publish(page, { title, body, visibility = "public" }) {
  await openWrite(page);
  await page.getByPlaceholder("제목").fill(title);
  if (visibility === "private") await page.getByRole("radio", { name: "🔒 비공개" }).click();
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(body);
  await page.getByRole("button", { name: "발행하기" }).click();
  await page.waitForURL(/\/@[a-z0-9_]+\/\d+/);
  return postIdOf(page);
}

// ── US1 글쓰기·발행 ──
await openWrite(a);
check("US1 본문 안내 문구", (await a.locator(".ProseMirror p[data-placeholder]").getAttribute("data-placeholder")) === "오늘 배운 것, 생각한 것, 무엇이든 적어 보세요 ✏️");
check("US3-1 기본 공개", (await a.getByRole("radio", { name: "🌍 공개" }).getAttribute("aria-checked")) === "true");
// 49자 + Enter + 50자 = 100자 → 보상 안내
await a.locator(".ProseMirror").click();
await a.keyboard.type("가".repeat(49));
await a.keyboard.press("Enter");
await a.keyboard.type("나".repeat(50));
check("US1 100자 안내", (await status(a)) === "100자 · 저장하면 ✨ 경험치 30 · 🪙 30 보상 (하루 3번까지)", await status(a));
await a.getByRole("radio", { name: "🔒 비공개" }).click();
check("US3-2 비공개 안내", (await status(a)) === "100자 · 비공개 글은 보상이 없어요", await status(a));
await a.getByRole("radio", { name: "🌍 공개" }).click();
// 빈 제목 → 오류, 입력값 유지
await a.getByLabel("태그").fill("남는 태그");
await a.getByRole("button", { name: "발행하기" }).click();
await a.getByText("제목을 적어 주세요").waitFor();
check("US1 빈 제목 → 오류, 태그 유지", (await a.getByLabel("태그").inputValue()) === "남는 태그" && a.url().endsWith("/write"));
await a.getByPlaceholder("제목").fill("   ");
await a.getByRole("button", { name: "발행하기" }).click();
await a.getByText("제목을 적어 주세요").waitFor();
check("US1 공백 제목 → 오류", a.url().endsWith("/write"));

// 빈 본문
await openWrite(a);
await a.getByPlaceholder("제목").fill("본문 없음");
await a.getByRole("button", { name: "발행하기" }).click();
await a.getByText("본문을 적어 주세요").waitFor({ timeout: 10000 }).catch(() => {});
check("US1 빈 본문 → '본문을 적어 주세요', 제목 유지", (await a.getByText("본문을 적어 주세요").isVisible()) && (await a.getByPlaceholder("제목").inputValue()) === "본문 없음");

// 50 + Shift+Enter + 49 = 99자
await openWrite(a);
await a.locator(".ProseMirror").click();
await a.keyboard.type("가".repeat(50));
await a.keyboard.press("Shift+Enter");
await a.keyboard.type("나".repeat(49));
check("US1 99자 안내", (await status(a)) === "99자 · 100자 이상 쓰면 보상을 받아요", await status(a));

// 보상 받는 글 발행 → 안내, 새로고침하면 사라짐
const rewardPost = await publish(a, { title: "보상 글", body: "오늘 배운 것을 정리합니다. ".repeat(8) });
await a.getByText("🎉 글을 발행했어요!").waitFor();
check("US1 보상 안내", (await a.getByText("🎉 글을 발행했어요!").innerText()).includes("✨ 경험치 30 · 🪙 30 코인을 받았어요"));
await a.waitForFunction(() => !location.search.includes("new"));
check("US1 주소에서 ?new 지움", !a.url().includes("new"));
await a.screenshot({ path: `${outDir}/post-write-notice.png` });
await a.reload();
check("US1 새로고침하면 안내 없음", !(await a.getByText("🎉 글을 발행했어요!").isVisible()));
// 다른 회원이 ?new=1로 열어도 안내 없음
await b.goto(`${BASE}/@${idA}/${rewardPost}?new=1`);
check("US1 다른 회원에게 안내 없음", !(await b.getByText("🎉 글을 발행했어요!").isVisible()));

// 짧은 글 → 보상 없음 안내
await publish(a, { title: "짧은 글", body: "짧다" });
check("US1 보상 없음 안내", (await a.getByText("🎉 글을 발행했어요!").innerText()).includes("보상은 없어요"));

// 서식 보존·위험 본문 제거 (서버 정화)
await openWrite(a);
await a.getByPlaceholder("제목").fill("서식 글");
const formatted = await a.evaluate(async () => {
  const html =
    '<h2>큰</h2><h3>작은</h3><p><strong>굵</strong><em>기</em><u>밑</u><s>취</s><a href="https://example.com">링크</a></p><ul><li>가</li></ul><ol><li>나</li></ol><blockquote><p>인용</p></blockquote><pre><code>코드</code></pre><hr><p>끝</p>' +
    '<script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">나쁜</a><iframe src="https://evil"></iframe><p onclick="alert(1)">클릭</p><img src="data:image/png;base64,AAAA">';
  const fd = new FormData();
  fd.set("title", "서식 글");
  fd.set("contentHtml", html);
  fd.set("visibility", "public");
  return html;
});
await a.locator(".ProseMirror").evaluate((el, html) => {
  const dt = new DataTransfer();
  dt.setData("text/html", html);
  el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
}, formatted);
await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/@[a-z0-9_]+\/\d+/);
const fmt = await one("SELECT content_html FROM posts WHERE id = $1", [postIdOf(a)]);
const kept = ["<h2>", "<h3>", "<strong>", "<em>", "<u>", "<s>", 'href="https://example.com"', "<ul>", "<ol>", "<blockquote>", "<pre>", "<hr"];
check("US1 서식 12가지 보존", kept.every((t) => fmt.content_html.includes(t)), kept.filter((t) => !fmt.content_html.includes(t)).join(","));
const bad = ["<script", "onerror", "javascript:", "<iframe", "onclick", "data:image"];
check("US1 위험 본문 6가지 제거", bad.every((t) => !fmt.content_html.includes(t)), bad.filter((t) => fmt.content_html.includes(t)).join(","));

// ── US2 수정·삭제 ──
await a.goto(`${BASE}/write/${rewardPost}`);
await a.locator(".ProseMirror").waitFor();
check("US2 수정 화면 저장값", (await a.getByPlaceholder("제목").inputValue()) === "보상 글");
check("US2 '글을 고치고 있어요'", (await status(a)).endsWith("글을 고치고 있어요"));
const before = await one("SELECT created_at FROM posts WHERE id = $1", [rewardPost]);
await a.getByPlaceholder("제목").fill("보상 글 (고침)");
await a.getByRole("button", { name: "수정 완료" }).click();
await a.waitForURL(new RegExp(`/@${idA}/${rewardPost}$`));
check("US2 수정 뒤 안내 없음", !(await a.getByText("🎉 글을 발행했어요!").isVisible()) && (await a.locator("h1").innerText()) === "보상 글 (고침)");
const after = await one("SELECT created_at FROM posts WHERE id = $1", [rewardPost]);
check("US2 작성 시각 그대로", before.created_at.getTime() === after.created_at.getTime());

// 남의 글·없는 글·범위 밖 수정 화면 → 404
for (const id of [rewardPost, 999999999, "2147483648", "abc"]) {
  const res = await b.goto(`${BASE}/write/${id}`);
  check(`US2 수정 화면 ${id === rewardPost ? "남의 글" : id} → 404`, res.status() === 404);
}
// 남의 글 수정 조작 → 오류 화면
await b.goto(`${BASE}/write`);
await b.locator(".ProseMirror").waitFor();
await b.getByPlaceholder("제목").fill("가로채기");
await b.locator(".ProseMirror").click();
await b.keyboard.type("남의 글을 고쳐 본다");
await b.locator("form", { has: b.getByPlaceholder("제목") }).evaluate((f, id) => {
  const i = document.createElement("input");
  i.type = "hidden";
  i.name = "postId";
  i.value = String(id);
  f.appendChild(i);
}, rewardPost);
await b.getByRole("button", { name: "발행하기" }).click();
await b.getByText("잠깐 문제가 생겼어요").waitFor({ timeout: 15000 }).catch(() => {});
check("US2 남의 글 수정 조작 → '잠깐 문제가 생겼어요'", await b.getByText("잠깐 문제가 생겼어요").isVisible());
check("US2 남의 글 그대로", (await one("SELECT title FROM posts WHERE id = $1", [rewardPost])).title === "보상 글 (고침)");

// 삭제 확인 창 문구·취소
await a.goto(`${BASE}/@${idA}/${rewardPost}`);
let dialogText = "";
a.once("dialog", (d) => {
  dialogText = d.message();
  d.dismiss();
});
await a.getByRole("button", { name: "삭제" }).click();
await a.waitForTimeout(300);
check("US2 삭제 확인 문구", dialogText === "이 글을 삭제할까요? 댓글과 공감도 함께 지워져요.");
check("US2 취소하면 그대로", Boolean(await one("SELECT id FROM posts WHERE id = $1", [rewardPost])));
const walletBefore = await one("SELECT SUM(coin_delta)::int AS c, SUM(exp_delta)::int AS e FROM point_ledger WHERE user_id = $1", [userA]);
a.once("dialog", (d) => d.accept());
await a.getByRole("button", { name: "삭제" }).click();
await a.waitForURL(new RegExp(`/@${idA}$`));
check("US2 삭제 → 블로그 홈", !(await one("SELECT id FROM posts WHERE id = $1", [rewardPost])));
const walletAfter = await one("SELECT SUM(coin_delta)::int AS c, SUM(exp_delta)::int AS e FROM point_ledger WHERE user_id = $1", [userA]);
check("US2 삭제 뒤 경험치·코인 그대로", walletBefore.c === walletAfter.c && walletBefore.e === walletAfter.e);

// 지운 글도 하루 3번에 포함: 보상 글 2개 더(총 3번) → 4번째는 보상 없음
await publish(a, { title: "보상 글 2", body: "오늘 배운 것을 정리합니다. ".repeat(8) });
await publish(a, { title: "보상 글 3", body: "오늘 배운 것을 정리합니다. ".repeat(8) });
await publish(a, { title: "보상 글 4", body: "오늘 배운 것을 정리합니다. ".repeat(8) });
check("US2 지운 글도 하루 3번에 포함", (await a.getByText("🎉 글을 발행했어요!").innerText()).includes("보상은 없어요"));

// ── US3 공개 범위 ──
const privatePost = await publish(a, { title: "비밀 글", body: "주인만 보는 글입니다", visibility: "private" });
// 글 화면으로 옮긴 직후에는 이전 화면 제목이 남아 있을 수 있어 바뀔 때까지 기다린다
await a.waitForFunction(() => document.title === "글 | Blogville", null, { timeout: 5000 }).catch(() => {});
check("US3 비공개 글 탭 제목(주인)", (await a.title()) === "글 | Blogville", await a.title());
for (const [who, page] of [
  ["다른 회원", b],
  ["방문자", guest],
]) {
  const res = await page.goto(`${BASE}/@${idA}/${privatePost}`);
  check(
    `US3 비공개 글 ${who} → 404 화면`,
    res.status() === 404 && (await page.getByText("길을 잃었어요").isVisible()) && (await page.getByText("찾는 블로그나 글이 없거나, 비공개 글이에요.").isVisible()),
  );
  check(`US3 ${who} 탭 제목`, (await page.title()) === "글 | Blogville", await page.title());
}
// 공개 → 비공개로 바뀐 글에 공감·댓글
const flipPost = await publish(a, { title: "곧 비공개", body: "공개였다가 비공개가 되는 글" });
await b.goto(`${BASE}/@${idA}/${flipPost}`);
await b.locator("textarea").first().fill("댓글");
await db.query("UPDATE posts SET visibility = 'private' WHERE id = $1", [flipPost]);
await b.getByRole("button", { name: /등록|댓글 달기|남기기/ }).first().click();
await b.getByText("글을 찾을 수 없어요").waitFor({ timeout: 10000 }).catch(() => {});
check("US3 비공개로 바뀐 글에 댓글 → '글을 찾을 수 없어요'", await b.getByText("글을 찾을 수 없어요").isVisible());
// 공개↔비공개 왕복 뒤 보상 없음
const ledgerBefore = (await one("SELECT COUNT(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'post'", [userA])).n;
await a.goto(`${BASE}/write/${privatePost}`);
await a.locator(".ProseMirror").waitFor();
await a.getByRole("radio", { name: "🌍 공개" }).click();
await a.getByRole("button", { name: "수정 완료" }).click();
await a.waitForURL(new RegExp(`/@${idA}/${privatePost}$`));
const ledgerAfter = (await one("SELECT COUNT(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'post'", [userA])).n;
check("US3 비공개→공개 수정은 보상 없음", ledgerBefore === ledgerAfter);

// 로그아웃 상태 /write → /
await guest.goto(`${BASE}/write`);
check("US1 로그아웃 시 /write → /", new URL(guest.url()).pathname === "/");

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
