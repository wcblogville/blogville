// 마을 소식 [🌐 모든 글]과 👥 이웃 공개 글 (SOC-05·POST-02, 사용자 요청 2026-10-12
// "모든 글 볼 수 있는 페이지 … 게시판에 만들고 … 여기 안 나오게 이웃에게만 공개")
// 사용: 개발 서버를 띄운 상태에서 node e2e/all-posts.mjs <스크린샷 폴더>
// 실행마다 새 회원 A(글쓴이)·F(A의 이웃)·S(모르는 사람)를 만든다. 모든 글 첫 장에 오도록 미래 시각으로 넣은 글은 끝에 지운다
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
const n = Date.now() % 100_000_000;

async function member(id, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await loginDev(page, id);
  return { ctx, page, errors };
}
const userId = async (username) => (await one("SELECT id FROM users WHERE username = $1", [username])).id;
const blogOf = async (username) => (await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [username])).id;
const FUTURE = `${-(86400 * 730)} seconds`; // 2년 뒤: 다른 시험 글보다 위
const newPost = async (username, title, visibility = "public") =>
  (
    await one(
      "INSERT INTO posts (blog_id, title, content_html, content_text, visibility, created_at, updated_at) VALUES ($1, $2, '<p>x</p>', 'x', $3, now() - $4::interval, now() - $4::interval) RETURNING id",
      [await blogOf(username), title, visibility, FUTURE],
    )
  ).id;
const titles = async (page) => page.locator("article h3").allInnerTexts();
const status = (page, url) => page.evaluate(async (url) => (await fetch(url)).status, url);
const pngBytes = () => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 64 }, () => Math.floor(Math.random() * 256))];

const idA = `apa${n}`;
const idF = `apf${n}`;
const idS = `aps${n}`;
const A = await member(idA);
const F = await member(idF);
const S = await member(idS);
const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const guest = await guestCtx.newPage();
const guestErrors = collectErrors(guest);
await guest.goto(BASE);

// ── A가 글쓰기 화면에서 👥 이웃 공개로 사진 한 장 넣은 글을 쓴다 ──
const a = A.page;
const img = await a.evaluate(async (bytes) => {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(bytes)], "이웃사진.png", { type: "image/png" }));
  return (await fetch("/api/uploads", { method: "POST", body: fd })).json();
}, pngBytes());
check("준비: 사진 올림", Boolean(img?.key), JSON.stringify(img).slice(0, 80));
await a.goto(`${BASE}/write`);
await a.locator(".ProseMirror").waitFor();
const radios = await a.getByRole("radiogroup", { name: "공개 설정" }).getByRole("radio").allInnerTexts();
const publicHint = await a.locator('[data-visibility-hint="public"]').innerText();
check("글쓰기: 전체 공개(기본)면 모두에게 보인다는 주의 안내", publicHint.includes("모든 회원에게 보여요") && publicHint.includes("개인정보는 쓰지 말아 주세요"), publicHint.slice(0, 50));
await a.locator('[data-visibility-hint="public"]').scrollIntoViewIfNeeded();
await a.screenshot({ path: `${outDir}/write-public-notice-1280.png`, fullPage: false });
await a.setViewportSize({ width: 375, height: 800 });
await a.locator('[data-visibility-hint="public"]').scrollIntoViewIfNeeded();
await a.screenshot({ path: `${outDir}/write-public-notice-375.png`, fullPage: false });
await a.setViewportSize({ width: 1280, height: 900 });
check("글쓰기: 공개 설정 세 칸 [🌍 공개] [👥 이웃 공개] [🔒 비공개]", radios.join() === "🌍 공개,👥 이웃 공개,🔒 비공개", radios.join());
const neighborsTitle = `A 이웃 공개 글 ${n}`;
const tag = `이웃태그${n}`;
await a.getByPlaceholder("제목").fill(neighborsTitle);
await a.getByRole("radio", { name: "👥 이웃 공개" }).click();
check("글쓰기: 이웃 공개 고름(aria-checked)", (await a.getByRole("radio", { name: "👥 이웃 공개" }).getAttribute("aria-checked")) === "true");
check("글쓰기: 이웃 공개 설명 한 줄", (await a.locator("[data-visibility-hint]").innerText()).includes("나를 이웃 추가한 회원만"));
check("글쓰기: 이웃 공개면 전체 공개 주의 안내가 사라짐", (await a.locator('[data-visibility-hint="public"]').count()) === 0 && !(await a.locator("main").innerText()).includes("개인정보는 쓰지 말아 주세요"));
await a.getByRole("radio", { name: "🔒 비공개" }).click();
check("글쓰기: 비공개면 `나만 볼 수 있어요`, 주의 안내 없음", (await a.locator('[data-visibility-hint="private"]').innerText()).includes("나만 볼 수 있어요"));
await a.getByRole("radio", { name: "👥 이웃 공개" }).click();
check("글쓰기: 이웃 공개 글은 보상이 없다는 안내", await a.getByText("이웃 공개 글은 보상이 없어요").isVisible());
await a.locator(".ProseMirror").click();
await a.keyboard.type("이웃에게만 보여 주는 글이에요.");
await a.locator(".ProseMirror").evaluate((el, html) => {
  const dt = new DataTransfer();
  dt.setData("text/html", html);
  el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
}, `<p><img src="${img.url}" alt=""></p>`);
await a.waitForTimeout(800);
await a.getByLabel("태그").fill(tag);
await a.screenshot({ path: `${outDir}/write-visibility-1280.png`, fullPage: false });
await a.setViewportSize({ width: 375, height: 800 });
await a.locator('[role="radiogroup"]').scrollIntoViewIfNeeded();
await a.screenshot({ path: `${outDir}/write-visibility-375.png`, fullPage: false });
const noHScroll = await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
check("글쓰기 375px: 가로 스크롤 없음", noHScroll);
await a.setViewportSize({ width: 1280, height: 900 });
await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/@[a-z0-9_]+\/\d+/);
const neighborsPost = Number(new URL(a.url()).pathname.match(/\/(\d+)$/)[1]);
const saved = await one("SELECT visibility FROM posts WHERE id = $1", [neighborsPost]);
check("저장: posts.visibility = neighbors", saved?.visibility === "neighbors", saved?.visibility);
const linked = await one("SELECT post_id FROM attachments WHERE key = $1", [img.key]);
check("저장: 사진이 이 글에 붙음", linked?.post_id === neighborsPost, String(linked?.post_id));
check("주인: 글 상세에 👥 이웃 공개 배지", (await a.locator('[data-visibility-badge="neighbors"]').count()) === 1);
const ledger = await one("SELECT COUNT(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'post'", [await userId(idA)]);
check("보상: 이웃 공개 글은 글쓰기 보상 없음", ledger.n === 0, String(ledger.n));
// 이웃 공개 글이 첫 장에 섞여 들어오면 바로 보이게 미래 시각으로 옮긴다
await db.query("UPDATE posts SET created_at = now() - $2::interval WHERE id = $1", [neighborsPost, FUTURE]);

// 모든 글 첫 장에 오는 공개 글
const aPublic = await newPost(idA, `A 공개 글 ${n}`);
const sPublic = await newPost(idS, `S 모르는 사람 공개 글 ${n}`);
const sPrivate = await newPost(idS, `S 비공개 글 ${n}`, "private");
const sNeighbors = await newPost(idS, `S 이웃 공개 글 ${n}`, "neighbors");
await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)", [await userId(idF), await userId(idA)]);

// ── 🌐 모든 글 ──
await guest.goto(`${BASE}/feed/all`);
check("모든 글: 탭 제목 `모든 글 | Blogville`", (await guest.title()) === "모든 글 | Blogville", await guest.title());
check("모든 글: 방문자도 [🌐 모든 글] 탭이 지금 탭", (await guest.locator('a.pixel-tab[href="/feed/all"][aria-current="page"]').count()) === 1);
const hint = await guest.locator("[data-feed-hint]").innerText();
check("모든 글: 설명(모든 회원의 공개 글 + 이웃 공개 안내)", hint.includes("모든 회원의 전체 공개 글") && hint.includes("👥 이웃 공개"), hint.slice(0, 60));
const allTitles = await titles(guest);
check("모든 글: 모르는 사람 S와 A의 공개 글이 보임", allTitles.includes(`S 모르는 사람 공개 글 ${n}`) && allTitles.includes(`A 공개 글 ${n}`), allTitles.slice(0, 4).join());
check("모든 글: 이웃 공개·비공개 글은 없음",
  [neighborsTitle, `S 비공개 글 ${n}`, `S 이웃 공개 글 ${n}`].every((t) => !allTitles.includes(t)) &&
  (await guest.locator(`article a[href$="/${neighborsPost}"], article a[href$="/${sPrivate}"], article a[href$="/${sNeighbors}"]`).count()) === 0);
check("모든 글: 말 조심 한 줄", (await guest.locator("[data-feed-manners]").innerText()).includes("개인정보는 쓰지 말아 주세요"));
check("모든 글: 공지 블로그 글은 목록에 없음", (await guest.locator('article a[href^="/@notice"]').count()) === 0);
await guest.screenshot({ path: `${outDir}/all-posts-1280.png`, fullPage: false });
const f = F.page;
await f.goto(`${BASE}/feed/all`);
check("모든 글: 이웃 F가 봐도 이웃 공개 글은 없음 (이웃 글은 마을 소식 다른 탭)", !(await titles(f)).includes(neighborsTitle));
const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
const mobile = await mobileCtx.newPage();
const mobileErrors = collectErrors(mobile);
await mobile.goto(`${BASE}/feed/all`);
check("모든 글 375px: 가로 스크롤 없음", await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await mobile.locator("[data-feed-hint]").scrollIntoViewIfNeeded();
await mobile.screenshot({ path: `${outDir}/all-posts-375.png`, fullPage: false });
// 게시판 입구(/feed?board=1)에서도 탭으로 간다
await f.goto(`${BASE}/feed?board=1`);
const boardWin = f.locator("dialog[data-attendance-window]");
await boardWin.waitFor({ timeout: 5000 }).catch(() => {});
if (await boardWin.isVisible()) await boardWin.getByRole("button", { name: "출석 체크 창 닫기" }).click();
await f.locator('a.pixel-tab[href="/feed/all"]').click();
await f.waitForURL(/\/feed\/all$/);
check("게시판(/feed?board=1) → [🌐 모든 글] 탭", true);
await guest.goto(`${BASE}/feed`);
check("마을 소식 방문자 안내에 🌐 모든 글 링크", (await guest.locator('main a[href="/feed/all"]').count()) >= 2);

// ── 👥 이웃 공개 글: 이웃 F ──
const postUrl = `/@${idA}/${neighborsPost}`;
const res = await f.goto(`${BASE}${postUrl}`);
check("이웃 F: 이웃 공개 글 상세 200 + 배지", res?.status() === 200 && (await f.locator('[data-visibility-badge="neighbors"]').count()) === 1, String(res?.status()));
check("이웃 F: 탭 제목은 `글 | Blogville` (비공개처럼 제목을 넣지 않음)", (await f.title()) === "글 | Blogville", await f.title());
await f.locator('[data-visibility-badge="neighbors"]').scrollIntoViewIfNeeded();
await f.screenshot({ path: `${outDir}/neighbors-post-badge.png`, fullPage: false });
check("이웃 F: 사진 첨부 열림 200", (await status(f, img.url)) === 200);
await f.goto(`${BASE}/feed/following`);
check("이웃 F: 💛 이웃 새 글에 이웃 공개 글", (await titles(f)).includes(neighborsTitle));
await f.goto(`${BASE}/@${idA}`);
const blogCard = f.locator("article", { hasText: neighborsTitle });
check("이웃 F: 블로그 홈 목록에 이웃 공개 글 + 👥 배지", (await blogCard.count()) === 1 && (await blogCard.locator('[data-visibility-badge="neighbors"]').count()) === 1);
await blogCard.scrollIntoViewIfNeeded();
await f.screenshot({ path: `${outDir}/blog-list-badge.png`, fullPage: false });
// 이웃은 공감·댓글을 할 수 있다
await f.goto(`${BASE}${postUrl}`);
await f.getByPlaceholder(/댓글/).first().fill("이웃 댓글이에요");
await f.getByRole("button", { name: /댓글 등록|등록/ }).first().click();
await f.waitForTimeout(1500);
const cmt = await one("SELECT COUNT(*)::int AS n FROM comments WHERE post_id = $1", [neighborsPost]);
check("이웃 F: 이웃 공개 글에 댓글 저장", cmt.n === 1, String(cmt.n));

// ── 이웃이 아닌 S·방문자 ──
const s = S.page;
const sRes = await s.goto(`${BASE}${postUrl}`);
check("이웃 아닌 S: 이웃 공개 글 404", sRes?.status() === 404, String(sRes?.status()));
check("이웃 아닌 S: 사진 첨부 404", (await status(s, img.url)) === 404);
await s.goto(`${BASE}/@${idA}`);
check("이웃 아닌 S: 블로그 홈·옆 칸에 이웃 공개 글 제목 없음", !(await s.locator("main").innerText()).includes(neighborsTitle));
const gRes = await guest.goto(`${BASE}${postUrl}`);
check("방문자: 이웃 공개 글 404", gRes?.status() === 404, String(gRes?.status()));
check("방문자: 사진 첨부 404", (await status(guest, img.url)) === 404);
await guest.goto(`${BASE}/tags/${encodeURIComponent(tag)}`);
check("태그별 글: 이웃 공개 글 없음", !(await titles(guest)).includes(neighborsTitle));
await f.goto(`${BASE}/tags/${encodeURIComponent(tag)}`);
check("태그별 글: 이웃 F가 봐도 없음", !(await titles(f)).includes(neighborsTitle));
// 이웃 아닌 S가 공감·댓글을 조작해 보내도 저장되지 않는다: 서버 액션을 직접 부를 수 없으니 이웃을 끊고 같은 화면에서 시험한다
await db.query("DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2", [await userId(idF), await userId(idA)]);
const fGone = await f.goto(`${BASE}${postUrl}`);
check("이웃을 끊으면 F도 404", fGone?.status() === 404, String(fGone?.status()));
check("이웃을 끊으면 F도 사진 404", (await status(f, img.url)) === 404);

// ── 주인 글 관리: 이웃 공개 거르기 ──
await a.goto(`${BASE}/settings/posts?vis=neighbors`);
const managed = await a.locator("[data-manage-post]").count();
check("글 관리: 👥 이웃 공개 거르기에 이웃 공개 글만", managed === 1 && (await a.locator(`[data-manage-post="${neighborsPost}"]`).count()) === 1, String(managed));

// 정리: 첫 장에 오도록 넣은 글
await db.query("DELETE FROM posts WHERE id = ANY($1)", [[neighborsPost, aPublic, sPublic, sPrivate, sNeighbors]]);
const errs = [...A.errors, ...F.errors, ...S.errors, ...guestErrors, ...mobileErrors].filter((e) => !e.includes("404"));
check("화면 오류 없음", errs.length === 0, errs.slice(0, 3).join(" | "));
console.log(results.join("\n"));
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
