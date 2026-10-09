// 글 목록·페이지·태그 (POST-04·POST-05, TOWN-08 / US4·US6, quickstart §4)
// 사용: 개발 서버를 띄운 상태에서 node e2e/post-lists.mjs <스크린샷 폴더>
// 실행마다 새 회원을 만들고, 글은 DB에 바로 넣어 빠르게 준비한다
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
const ctxGuest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctxA.newPage();
const guest = await ctxGuest.newPage();
const errors = collectErrors(a);
const n = Date.now() % 100_000_000;
const idA = `pla${n}`;
await loginDev(a, idA);
const blog = await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [idA]);

// 글 9개: 1분 간격으로 오래된 것부터 (마지막 글이 가장 최신). 5번째 글은 비공개
const ids = [];
for (let i = 1; i <= 9; i++) {
  const { id } = await one(
    `INSERT INTO posts (blog_id, title, content_html, content_text, visibility, created_at, updated_at)
     VALUES ($1, $2, '<p>본문</p>', '본문', $3, now() - ($4 || ' minutes')::interval, now()) RETURNING id`,
    [blog.id, `목록 글 ${i}`, i === 5 ? "private" : "public", String(10 - i)],
  );
  ids.push(id);
}
const titles = (page) => page.locator("article h3").allInnerTexts();

// ── US4 블로그 홈 페이지 ──
await a.goto(`${BASE}/@${idA}`);
const p1 = await titles(a);
check("US4-1 1페이지 8개 최신순", p1.length === 8 && p1[0] === "목록 글 9" && p1[7] === "목록 글 2", p1.join(","));
await a.goto(`${BASE}/@${idA}?page=2`);
check("US4-1 2페이지 1개", (await titles(a)).join() === "목록 글 1");
await guest.goto(`${BASE}/@${idA}`);
const guestTitles = await titles(guest);
check("US3 비공개 글은 방문자 목록에서 빠짐", guestTitles.length === 8 && !guestTitles.includes("목록 글 5"));
await guest.goto(`${BASE}/@${idA}/${ids[5]}`);
const adjacent = await guest.locator('nav[aria-label="이전 글, 다음 글"]').innerText();
check("US3 이전/다음 글에서 비공개 글 빠짐", adjacent.includes("목록 글 4") && !adjacent.includes("목록 글 5"), adjacent.replace(/\n/g, " "));
// 다음 글은 바로 다음 글이어야 한다 (DB 시각은 마이크로초라 JS Date로 비교하면 자기 자신이 나왔다)
check("US3 다음 글은 바로 다음 글(자기 자신 아님)", adjacent.includes("목록 글 7") && !adjacent.includes("목록 글 6"), adjacent.replace(/\n/g, " "));
await guest.goto(`${BASE}/@${idA}/${ids[8]}`);
const newest = await guest.locator('nav[aria-label="이전 글, 다음 글"]').innerText();
check("US3 가장 최신 글에는 다음 글 없음", newest.includes("목록 글 8") && !newest.includes("다음 글"), newest.replace(/\n/g, " "));
for (const bad of ["0", "-1", "abc", "2.5", "012", "1e1", "99999999999999999999"]) {
  const res = await a.goto(`${BASE}/@${idA}?page=${bad}`);
  const t = await titles(a);
  check(`US4 ?page=${bad} → 1페이지`, res.status() === 200 && t[0] === "목록 글 9");
}
await a.goto(`${BASE}/@${idA}?page=99`);
check("US4 마지막보다 큰 페이지 → 빈 목록", (await titles(a)).length === 0);

// 8개 이하면 페이지 번호 숨김
await db.query("DELETE FROM posts WHERE id = $1", [ids[0]]);
await a.goto(`${BASE}/@${idA}`);
check("US4 8개 이하 페이지 번호 숨김", !(await a.locator('nav[aria-label="페이지"]').isVisible()));

// 생략 표시: 글 160개 → 20페이지, 10페이지에서 `1 … 8 9 10 11 12 … 20`
await db.query(
  `INSERT INTO posts (blog_id, title, content_html, content_text, created_at, updated_at)
   SELECT $1, '많은 글 ' || g, '<p>x</p>', 'x', now() - interval '1 day' - (g || ' minutes')::interval, now() FROM generate_series(1, 152) g`,
  [blog.id],
);
await a.goto(`${BASE}/@${idA}?page=10`);
const pageNav = (await a.locator('nav[aria-label="페이지"]').innerText()).replace(/\s+/g, " ").trim();
check("US4 페이지 번호 생략 표시", pageNav === "1 … 8 9 10 11 12 … 20", pageNav);
check("US4 현재 페이지 aria-current", (await a.locator('nav[aria-label="페이지"] [aria-current="page"]').innerText()) === "10");

// 수정해도 순서·날짜 그대로
await a.goto(`${BASE}/write/${ids[8]}`);
await a.locator(".ProseMirror").waitFor();
const dateBefore = await one("SELECT created_at FROM posts WHERE id = $1", [ids[8]]);
await a.getByPlaceholder("제목").fill("목록 글 9 (고침)");
await a.getByRole("button", { name: "수정 완료" }).click();
await a.waitForURL(new RegExp(`/@${idA}/${ids[8]}$`));
await a.goto(`${BASE}/@${idA}`);
check("US4 수정 뒤 순서 그대로", (await titles(a))[0] === "목록 글 9 (고침)");
check("US4 수정 뒤 작성 시각 그대로", (await one("SELECT created_at FROM posts WHERE id = $1", [ids[8]])).created_at.getTime() === dateBefore.created_at.getTime());

// 작성자 줄: 마을 소식에는 있고 블로그 홈에는 없음
check("US4 블로그 홈 카드에 작성자 줄 없음", (await a.locator(`article a[href="/@${idA}"]`).count()) === 0);
await a.goto(`${BASE}/feed`);
// 다른 시험이 만든 더 새 글이 1페이지를 채울 수 있어 카드마다 작성자 줄(→ 블로그 홈)이 있는지만 본다
const feedCards = await a.locator("article").count();
const authorLines = await a.locator('article > a:first-child[href^="/@"]').evaluateAll((els) => els.filter((e) => !/\/\d+$/.test(e.getAttribute("href"))).length);
check("US4 마을 소식 카드에 작성자 줄", feedCards > 0 && authorLines === feedCards, `${authorLines}/${feedCards}`);

// 로그아웃 이웃 새 글 → /
await guest.goto(`${BASE}/feed/following`);
check("US4 로그아웃 이웃 새 글 → /", new URL(guest.url()).pathname === "/");

// 빈 블로그 문구
const emptyId = `ple${n}`;
const ctxE = await browser.newContext();
const e = await ctxE.newPage();
await loginDev(e, emptyId);
await e.goto(`${BASE}/@${emptyId}`);
check("US4 빈 블로그 문구", await e.getByText("아직 글이 없어요.").isVisible());

// ── US6 태그 ──
await a.goto(`${BASE}/write`);
await a.locator(".ProseMirror").waitFor();
await a.getByPlaceholder("제목").fill("태그 글");
await a.locator(".ProseMirror").click();
await a.keyboard.type("태그를 단다");
const tag1 = `git${n}`;
await a.getByLabel("태그").fill(`${tag1}, #회고${n}, ${tag1.toUpperCase()}`);
await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/\d+(\?new=1)?$/);
const tagPost = Number(new URL(a.url()).pathname.split("/").pop());
const tagLinks = await a.locator('a[href^="/tags/"]').allInnerTexts();
check("US6-1 태그 두 개만", tagLinks.length === 2 && tagLinks.includes(`#${tag1}`) && tagLinks.includes(`#회고${n}`), tagLinks.join(","));
await a.locator(`a[href="/tags/${tag1}"]`).click();
await a.waitForURL(new RegExp(`/tags/${tag1}$`));
check("US6 태그별 목록", (await titles(a)).join() === "태그 글" && (await a.getByRole("heading", { name: `🏷 #${tag1}` }).isVisible()));
check("US6 태그 목록 탭 제목", (await a.title()) === `#${tag1} | Blogville`, await a.title());
await guest.goto(`${BASE}/tags/${tag1}`);
check("US6 로그아웃도 태그별 목록", (await titles(guest)).join() === "태그 글");
await guest.goto(`${BASE}/tags/없는태그${n}`);
check("US6 빈 태그 문구 (404 아님)", await guest.getByText("이 태그가 달린 글이 없어요.").isVisible());
// 태그 비우기
await a.goto(`${BASE}/write/${tagPost}`);
await a.locator(".ProseMirror").waitFor();
await a.getByLabel("태그").fill("");
await a.getByRole("button", { name: "수정 완료" }).click();
await a.waitForURL(new RegExp(`/@${idA}/${tagPost}$`));
check("US6 태그 비우면 배지 없음", (await a.locator('a[href^="/tags/"]').count()) === 0);
// 300자 입력 제한과 조작
await a.goto(`${BASE}/write/${tagPost}`);
await a.locator(".ProseMirror").waitFor();
check("US6 태그 칸 300자 제한", (await a.getByLabel("태그").getAttribute("maxlength")) === "300");
await a.getByLabel("태그").evaluate((el) => el.removeAttribute("maxlength"));
await a.getByLabel("태그").fill("a".repeat(301));
await a.getByRole("button", { name: "수정 완료" }).click();
await a.getByText("태그는 모두 합쳐 300자까지예요").waitFor({ timeout: 10000 }).catch(() => {});
check("US6 태그 301자 조작 → 문구", await a.getByText("태그는 모두 합쳐 300자까지예요").isVisible());
// % 태그
await a.goto(`${BASE}/write`);
await a.locator(".ProseMirror").waitFor();
await a.getByPlaceholder("제목").fill("퍼센트 태그");
await a.locator(".ProseMirror").click();
await a.keyboard.type("백 퍼센트");
await a.getByLabel("태그").fill(`100%${n}`);
await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/\d+(\?new=1)?$/);
await a.locator(`a[href="/tags/${encodeURIComponent(`100%${n}`)}"]`).click();
await a.waitForURL(/\/tags\//);
check("US6 % 태그 목록·탭 제목", (await titles(a)).join() === "퍼센트 태그" && (await a.title()) === `#100%${n} | Blogville`, await a.title());
// 비공개 글 태그 제외 (인기 태그 수·태그 목록)
await db.query("UPDATE posts SET visibility = 'private' WHERE title = '퍼센트 태그' AND blog_id = $1", [blog.id]);
await guest.goto(`${BASE}/tags/${encodeURIComponent(`100%${n}`)}`);
check("US6 비공개 글은 태그 목록에서 빠짐", await guest.getByText("이 태그가 달린 글이 없어요.").isVisible());
await guest.goto(`${BASE}/feed`);
check("US6 비공개 글 태그는 인기 태그에 없음", !(await guest.getByText(`#100%${n}`).isVisible()));

// ── 375px: 가로 스크롤 없음, 누르는 영역 44×44 ──
const m = await ctxA.newPage();
await m.setViewportSize({ width: 375, height: 800 });
for (const path of [`/@${idA}?page=10`, "/feed", `/tags/${tag1}`]) {
  await m.goto(`${BASE}${path}`);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`375px ${path} 가로 스크롤 없음`, overflow <= 0, `${overflow}px`);
}
await m.goto(`${BASE}/@${idA}?page=10`);
const small = async (selector) =>
  m.locator(selector).evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
check("375px 페이지 번호 44×44", (await small('nav[aria-label="페이지"] a')) === 0);
await m.screenshot({ path: `${outDir}/post-lists-375.png`, fullPage: true });
await m.goto(`${BASE}/feed`);
check("375px 마을 소식 탭 높이 44", (await m.locator('a[href="/feed"], a[href="/feed/following"]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length)) === 0);
check("375px 인기 태그 칩 높이 44", (await m.locator('a[href^="/tags/"]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length)) === 0);
check("375px 작성자 줄 높이 44", (await m.locator("article > a:first-child").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length)) === 0);

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
