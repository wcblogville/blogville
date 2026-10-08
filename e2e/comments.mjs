// 댓글·답글 (SOC-01, SOC-02 / US2, US5, SC-004·005·006·010, quickstart 4.1)
// 사용: 개발 서버를 띄운 상태에서 node e2e/comments.mjs <스크린샷 폴더>
// 실행마다 새 회원 A(글 주인)·B·C·D·E를 만들고, 관리자는 .env.local의 ADMIN_USERNAME으로 로그인한다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const count = async (q, p) => (await one(q, p)).n;

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const n = Date.now() % 100_000_000;
const ids = { A: `cma${n}`, B: `cmb${n}`, C: `cmc${n}`, D: `cmd${n}`, E: `cme${n}` };

async function member(id, password) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await loginDev(page, id, "남자 주민", password);
  page.on("dialog", (d) => d.accept());
  return { ctx, page, errors };
}
const userId = async (username) => (await one("SELECT id FROM users WHERE username = $1", [username])).id;
const blogOf = async (username) => (await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [username])).id;
const newPost = async (username, title, visibility = "public") =>
  (await one("INSERT INTO posts (blog_id, title, content_html, content_text, visibility) VALUES ($1, $2, '<p>x</p>', 'x', $3) RETURNING id", [await blogOf(username), title, visibility])).id;
const ledger = async (uid, reason = "comment") => count("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = $2", [uid, reason]);

const A = await member(ids.A);
const B = await member(ids.B);
const C = await member(ids.C);
const uid = { A: await userId(ids.A), B: await userId(ids.B), C: await userId(ids.C) };
const P = await newPost(ids.A, "댓글 받을 글");
const P2 = await newPost(ids.A, "지울 글");
const Q = await newPost(ids.B, "B의 비공개 글", "private");
const url = (id, owner = ids.A) => `${BASE}/@${owner}/${id}`;
const section = (page) => page.getByRole("region", { name: "댓글" });
const heading = async (page) => (await section(page).getByRole("heading").innerText()).trim();
const mainForm = (page) => section(page).locator("form").last();
async function write(page, text) {
  await mainForm(page).locator("textarea").fill(text);
  await mainForm(page).getByRole("button", { name: /댓글 등록|등록 중/ }).click();
}
const commentLine = (page, text) => section(page).locator('[id^="comment-"]', { hasText: text }).first();

// ══ US2 댓글 ══
// US2-1 B가 A의 글에 댓글 → 맨 아래, 입력칸 빔, 💬 +1, B 코인 +5
await B.page.goto(url(P));
const coinsBefore = await coins(B.page);
check("US2 처음 `💬 댓글 0`·빈 목록 문구 없음", (await heading(B.page)) === "💬 댓글 0");
const pendingSeen = (async () => {
  const btn = mainForm(B.page).getByRole("button", { name: "등록 중..." });
  return btn.waitFor({ timeout: 3000 }).then(async () => btn.isDisabled()).catch(() => null);
})();
await write(B.page, "  첫 댓글이에요  ");
const pending = await pendingSeen;
await commentLine(B.page, "첫 댓글이에요").waitFor();
check("US2-1 등록 → 목록에 보임(앞뒤 공백 정리)", (await commentLine(B.page, "첫 댓글이에요").locator("p").nth(1).innerText()) === "첫 댓글이에요");
check("US2-1 입력칸 비워짐", (await mainForm(B.page).locator("textarea").inputValue()) === "");
check("US2-1 `💬 댓글 1`", (await heading(B.page)) === "💬 댓글 1");
await B.page.reload();
check("US2-1 B 코인 +5", (await coins(B.page)) === coinsBefore + 5, `${coinsBefore} → ${await coins(B.page)}`);
check("US2-9 처리 중 `등록 중...` 비활성", pending !== false, String(pending));

// US2-2 내 글 댓글은 보상 없음, 내 비공개 글에도 댓글
await B.page.goto(url(Q, ids.B));
const bLedger = await ledger(uid.B);
await write(B.page, "내 비공개 글에 댓글");
await commentLine(B.page, "내 비공개 글에 댓글").waitFor();
check("US2 내 비공개 글에 댓글 등록", true);
check("US2-2 내 글 댓글은 보상 없음", (await ledger(uid.B)) === bLedger);

// US2-4 공백·1001자 → 문구, 내용 유지
await B.page.goto(url(P));
await write(B.page, "   ");
await section(B.page).getByText("댓글을 적어 주세요").waitFor();
check("US2-4 공백만 → `댓글을 적어 주세요`, 내용 유지", (await mainForm(B.page).locator("textarea").inputValue()) === "   ");
await mainForm(B.page).locator("textarea").evaluate((t) => t.removeAttribute("maxlength"));
await write(B.page, "가".repeat(1001));
await section(B.page).getByText("댓글은 1000자까지예요").waitFor();
check("US2-4 1001자 → `댓글은 1000자까지예요`, 내용 유지", (await mainForm(B.page).locator("textarea").inputValue()).length === 1001);
check("US2 입력칸 maxLength 1000", (await B.page.reload().then(() => mainForm(B.page).locator("textarea").getAttribute("maxlength"))) === "1000");

// US2-5 남의 비공개 글·없는 글 → 글을 찾을 수 없어요
for (const [name, target] of [["남의 비공개 글", Q], ["없는 글", 2_000_000_000]]) {
  await C.page.goto(url(P));
  const before = await count("SELECT count(*)::int AS n FROM comments");
  await mainForm(C.page).locator('input[name="postId"]').evaluate((i, v) => (i.value = String(v)), target);
  await write(C.page, "몰래 쓰는 댓글");
  await section(C.page).getByText("글을 찾을 수 없어요").waitFor({ timeout: 10000 }).catch(() => {});
  check(`US2-5 ${name} → \`글을 찾을 수 없어요\`, 저장 0`, (await section(C.page).getByText("글을 찾을 수 없어요").isVisible()) && (await count("SELECT count(*)::int AS n FROM comments")) === before);
}

// US2-7 HTML·주소·줄바꿈은 글자 그대로
await C.page.goto(url(P));
await mainForm(C.page).locator("textarea").fill("<b>굵게</b> https://example.com\n두 번째 줄");
await mainForm(C.page).getByRole("button", { name: "댓글 등록" }).click();
const cLine = commentLine(C.page, "<b>굵게</b>");
await cLine.waitFor();
check("US2-7 HTML 태그·주소 글자 그대로", (await cLine.locator("b").count()) === 0 && (await cLine.locator("a[href^='https://example']").count()) === 0);
check("US2-7 줄바꿈 유지", (await cLine.locator("p").nth(1).innerText()) === "<b>굵게</b> https://example.com\n두 번째 줄");

// US2-6 방문자: 로그인 안내, [답글]·[삭제] 없음
const guestCtx = await browser.newContext();
const guest = await guestCtx.newPage();
await guest.goto(url(P));
const loginLink = section(guest).getByRole("link", { name: "로그인" });
check("US2-6 방문자 `로그인하면 댓글을 남길 수 있어요`·링크 /", (await section(guest).getByText("하면 댓글을 남길 수 있어요").isVisible()) && (await loginLink.getAttribute("href")) === "/");
check("US2-6 방문자 입력칸·[답글]·[삭제] 없음",
  (await section(guest).locator("textarea").count()) === 0 &&
  (await section(guest).getByRole("button", { name: "답글", exact: true }).count()) === 0 &&
  (await section(guest).getByRole("button", { name: "삭제", exact: true }).count()) === 0);
check("US2 `로그인` 링크 높이 44px", (await loginLink.boundingBox()).height >= 44);

// US2-8 [삭제]는 권한 있는 줄에만: C에게는 C 댓글에만, A(블로그 주인)에게는 모두
await C.page.goto(url(P));
check("US2-8 C에게 [삭제]는 C 댓글에만",
  (await commentLine(C.page, "첫 댓글이에요").getByRole("button", { name: "삭제" }).count()) === 0 &&
  (await commentLine(C.page, "<b>굵게</b>").getByRole("button", { name: "삭제" }).count()) === 1);
await A.page.goto(url(P));
check("US2-8 블로그 주인 A에게 모든 댓글 [삭제]", (await section(A.page).getByRole("button", { name: "삭제", exact: true }).count()) === 2);

// US2-10 삭제 확인 창 [취소] → 그대로
A.page.removeAllListeners("dialog");
A.page.once("dialog", (d) => d.dismiss());
await commentLine(A.page, "첫 댓글이에요").getByRole("button", { name: "삭제" }).click();
await A.page.waitForTimeout(500);
check("US2-10 확인 창 [취소] → 그대로", (await count("SELECT count(*)::int AS n FROM comments WHERE post_id = $1 AND deleted_at IS NULL", [P])) === 2);
A.page.on("dialog", (d) => d.accept());

// US2-11 작성자 삭제 → 자리, 💬 −1, 원래 내용 DB에도 없음
const cRow = await one("SELECT id FROM comments WHERE post_id = $1 AND author_id = $2", [P, uid.C]);
await C.page.goto(url(P));
await commentLine(C.page, "<b>굵게</b>").getByRole("button", { name: "삭제" }).click();
await section(C.page).getByText("삭제된 댓글이에요").waitFor();
check("US2-11 작성자 삭제 → `삭제된 댓글이에요`·버튼 없음",
  (await section(C.page).locator(`#comment-${cRow.id}`).getByRole("button").count()) === 0);
check("US2-11 `💬 댓글 1`", (await heading(C.page)) === "💬 댓글 1");
const deleted = await one("SELECT content, deleted_at IS NOT NULL AS d FROM comments WHERE id = $1", [cRow.id]);
check("US2-11 DB 내용 빈 글자", deleted.content === "" && deleted.d);
// SC-006 HTML·RSC 응답에 지운 내용·작성자 회원 ID 0건
const html = await (await guest.request.get(url(P))).text();
const rsc = await (await guest.request.get(url(P), { headers: { RSC: "1" } })).text();
check("SC-006 HTML·RSC에 지운 내용 없음", !html.includes("굵게") && !rsc.includes("굵게"));
check("SC-006 HTML·RSC에 댓글 작성자 회원 ID 없음", ![uid.B, uid.C].some((id) => html.includes(id) || rsc.includes(id)));

// US2-12 블로그 주인 삭제
await A.page.goto(url(P));
await commentLine(A.page, "첫 댓글이에요").getByRole("button", { name: "삭제" }).click();
await A.page.waitForFunction(() => document.querySelector("#comments h2")?.textContent?.includes("💬 댓글 0"));
check("US2-12 블로그 주인이 남의 댓글 삭제", (await count("SELECT count(*)::int AS n FROM comments WHERE post_id = $1 AND deleted_at IS NULL", [P])) === 0);

// SC-005 권한 없는 삭제·이미 삭제·범위 밖 → 변화 0, HTTP 200
await C.page.goto(url(P));
await write(C.page, "C의 새 댓글");
await commentLine(C.page, "C의 새 댓글").waitFor();
const requestP = C.page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
await B.page.goto(url(P));
await write(B.page, "B 댓글(조작 대상 아님)");
await commentLine(B.page, "B 댓글(조작").waitFor();
await commentLine(C.page, "C의 새 댓글").getByRole("button", { name: "삭제" }).click();
const delReq = await requestP;
await C.page.waitForLoadState("networkidle");
const bComment = await one("SELECT id FROM comments WHERE post_id = $1 AND author_id = $2 AND deleted_at IS NULL", [P, uid.B]);
const forge = (page, args) =>
  page.evaluate(
    async ({ actionId, contentType, body }) =>
      (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType }, body })).status,
    { actionId: delReq.headers()["next-action"], contentType: delReq.headers()["content-type"], body: JSON.stringify(args) },
  );
const snapshot = async () => JSON.stringify((await db.query("SELECT id, content, deleted_at FROM comments WHERE post_id = $1 ORDER BY id", [P])).rows);
// C의 삭제가 끝난 뒤의 상태를 기준으로 삼는다
for (let i = 0; i < 50 && (await count("SELECT count(*)::int AS n FROM comments WHERE post_id = $1 AND author_id = $2 AND deleted_at IS NULL", [P, uid.C])) > 0; i++) await C.page.waitForTimeout(100);
const snapBefore = await snapshot();
const statuses = [await forge(C.page, [bComment.id]), await forge(C.page, [cRow.id]), await forge(C.page, [99999999999])];
const snapAfter = await snapshot();
check("SC-005 남의 댓글·이미 삭제·범위 밖 삭제 요청 → 변화 0·HTTP 200", snapAfter === snapBefore && statuses.every((s) => s === 200), `${statuses.join()} ${snapAfter === snapBefore ? "" : `${snapBefore} → ${snapAfter}`}`);

// US2-13 관리자 삭제
{
  const admin = await member(ADMIN.username, ADMIN.password);
  await admin.page.goto(url(P));
  await commentLine(admin.page, "B 댓글(조작").getByRole("button", { name: "삭제" }).click();
  await admin.page.waitForFunction(() => document.querySelector("#comments h2")?.textContent?.includes("💬 댓글 0"));
  check("US2-13 관리자가 남의 댓글 삭제", (await one("SELECT deleted_at FROM comments WHERE id = $1", [bComment.id])).deleted_at !== null);
}

// US2-3 로그인 풀린 뒤 등록·삭제 → / 이동·저장 0
const ghost = await member(`cmg${n}`);
await ghost.page.goto(url(P));
await ghost.ctx.clearCookies();
const beforeGhost = await count("SELECT count(*)::int AS n FROM comments");
await write(ghost.page, "로그인 풀린 댓글");
await ghost.page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 }).catch(() => {});
check("US2-3 로그인 풀린 뒤 등록 → / 이동·저장 0", new URL(ghost.page.url()).pathname === "/" && (await count("SELECT count(*)::int AS n FROM comments")) === beforeGhost);

// ══ US5 답글 ══
await A.page.goto(url(P));
await write(A.page, "A의 원댓글");
await commentLine(A.page, "A의 원댓글").waitFor();
const root = await one("SELECT id FROM comments WHERE post_id = $1 AND author_id = $2 AND deleted_at IS NULL", [P, uid.A]);
const rootLine = (page) => section(page).locator(`#comment-${root.id}`);
const replyForm = (page) => rootLine(page).locator("form");
await B.page.goto(url(P));
await rootLine(B.page).getByRole("button", { name: "답글", exact: true }).click();
check("US5-1 [답글] → 2줄 입력칸 `답글을 남겨 주세요`", (await replyForm(B.page).locator("textarea").getAttribute("placeholder")) === "답글을 남겨 주세요" && (await replyForm(B.page).locator("textarea").getAttribute("rows")) === "2");
check("US5-1 자동 커서 없음", !(await replyForm(B.page).locator("textarea").evaluate((t) => t === document.activeElement)));
await replyForm(B.page).locator("textarea").fill("쓰다 만 답글");
await replyForm(B.page).getByRole("button", { name: "답글 취소" }).click();
check("US5-2 [답글 취소] → 닫힘", (await replyForm(B.page).count()) === 0);
await rootLine(B.page).getByRole("button", { name: "답글", exact: true }).click();
check("US5-2 다시 열면 빈 칸", (await replyForm(B.page).locator("textarea").inputValue()) === "");
const bCoins = await coins(B.page);
for (const text of ["첫 답글", "둘째 답글"]) {
  if (!(await replyForm(B.page).count())) await rootLine(B.page).getByRole("button", { name: "답글", exact: true }).click();
  await replyForm(B.page).locator("textarea").fill(text);
  await replyForm(B.page).getByRole("button", { name: "답글 등록" }).click();
  await section(B.page).locator('[id^="reply-"]', { hasText: text }).waitFor();
  await replyForm(B.page).waitFor({ state: "detached" });
}
const replyTexts = await section(B.page).locator('[id^="reply-"] p:not(.text-sm)').allInnerTexts();
check("US5-3 답글 2개 오래된 순", replyTexts.join("|") === "첫 답글|둘째 답글", replyTexts.join("|"));
check("US5-3 들여쓰기·왼쪽 선", (await section(B.page).locator('[id^="reply-"]').first().getAttribute("class")).includes("border-l-2"));
check("US5-3 등록 뒤 입력칸 닫히고 [답글]", (await rootLine(B.page).getByRole("button", { name: "답글", exact: true }).count()) === 1);
check("US5-4 답글 줄에 [답글] 없음", (await section(B.page).locator('[id^="reply-"]').getByRole("button", { name: "답글", exact: true }).count()) === 0);
check("US5 `💬 댓글 3`(댓글 1 + 답글 2)", (await heading(B.page)) === "💬 댓글 3");
await B.page.reload();
check("US5 B 코인 +10(답글 2개)", (await coins(B.page)) === bCoins + 10);
await C.page.goto(url(P));
check("US5-4 답글 [삭제]는 C에게 없음", (await section(C.page).locator('[id^="reply-"]').getByRole("button", { name: "삭제" }).count()) === 0);

// US5 원댓글 삭제 시 입력칸을 연 채 → 삭제된 댓글에는 답글을 달 수 없어요
await rootLine(C.page).getByRole("button", { name: "답글", exact: true }).click();
await replyForm(C.page).locator("textarea").fill("늦은 답글");
await A.page.goto(url(P));
await rootLine(A.page).getByRole("button", { name: "삭제", exact: true }).first().click();
await rootLine(A.page).getByText("삭제된 댓글이에요").waitFor();
check("US5-5 `💬 댓글 2`", (await heading(A.page)) === "💬 댓글 2", await heading(A.page));
check("US5-5 원댓글 삭제 뒤 답글 2개 그대로", (await section(A.page).locator('[id^="reply-"]').count()) === 2);
check("US5-5 지운 원댓글에 [답글] 없음", (await rootLine(A.page).getByRole("button", { name: "답글", exact: true }).count()) === 0);
const repliesBefore = await count("SELECT count(*)::int AS n FROM replies");
await replyForm(C.page).getByRole("button", { name: "답글 등록" }).click();
await replyForm(C.page).getByText("삭제된 댓글에는 답글을 달 수 없어요").waitFor({ timeout: 10000 }).catch(() => {});
check("US5-6 지운 원댓글 답글 → 문구·내용 유지·저장 0",
  (await replyForm(C.page).getByText("삭제된 댓글에는 답글을 달 수 없어요").isVisible()) &&
  (await replyForm(C.page).locator("textarea").inputValue()) === "늦은 답글" &&
  (await count("SELECT count(*)::int AS n FROM replies")) === repliesBefore);

// US5-7 없는 댓글·다른 글의 댓글 → 답글을 달 댓글이 없어요
await A.page.goto(url(P2));
await write(A.page, "P2의 댓글");
await commentLine(A.page, "P2의 댓글").waitFor();
const p2Comment = await one("SELECT id FROM comments WHERE post_id = $1", [P2]);
await A.page.goto(url(P));
await write(A.page, "새 원댓글");
await commentLine(A.page, "새 원댓글").waitFor();
const root2 = await one("SELECT id FROM comments WHERE post_id = $1 AND content = '새 원댓글'", [P]);
for (const [name, target] of [["없는 댓글", 2_000_000_000], ["다른 글의 댓글", p2Comment.id]]) {
  await C.page.goto(url(P));
  const line = section(C.page).locator(`#comment-${root2.id}`);
  await line.getByRole("button", { name: "답글", exact: true }).click();
  await line.locator('input[name="commentId"]').evaluate((i, v) => (i.value = String(v)), target);
  await line.locator("textarea").fill("엉뚱한 답글");
  const cnt = async () => `${await count("SELECT count(*)::int AS n FROM comments")}/${await count("SELECT count(*)::int AS n FROM replies")}`;
  const before = await cnt();
  await line.getByRole("button", { name: "답글 등록" }).click();
  await line.getByText("답글을 달 댓글이 없어요").waitFor({ timeout: 10000 }).catch(() => {});
  check(`US5-7 ${name} → \`답글을 달 댓글이 없어요\`·내용 유지·행 수 그대로`,
    (await line.getByText("답글을 달 댓글이 없어요").isVisible()) && (await line.locator("textarea").inputValue()) === "엉뚱한 답글" && (await cnt()) === before);
}
// 답글 공백·1001자
{
  await C.page.goto(url(P));
  const line = section(C.page).locator(`#comment-${root2.id}`);
  await line.getByRole("button", { name: "답글", exact: true }).click();
  await line.locator("textarea").fill("  ");
  await line.getByRole("button", { name: "답글 등록" }).click();
  check("US5-8 답글 공백 → `댓글을 적어 주세요`", await line.getByText("댓글을 적어 주세요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await line.locator("textarea").evaluate((t) => t.removeAttribute("maxlength"));
  await line.locator("textarea").fill("나".repeat(1001));
  await line.getByRole("button", { name: "답글 등록" }).click();
  check("US5-8 답글 1001자 → `댓글은 1000자까지예요`", await line.getByText("댓글은 1000자까지예요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
}

// US5-10 A(블로그 주인)가 B의 답글 삭제 → 자리, 💬 −1
await A.page.goto(url(P));
const countBefore = await heading(A.page);
await section(A.page).locator('[id^="reply-"]', { hasText: "첫 답글" }).getByRole("button", { name: "삭제" }).click();
await section(A.page).locator('[id^="reply-"]', { hasText: "삭제된 댓글이에요" }).waitFor();
check("US5-10 블로그 주인이 답글 삭제 → 자리·💬 −1", (await heading(A.page)) === `💬 댓글 ${Number(countBefore.replace(/\D/g, "")) - 1}`, `${countBefore} → ${await heading(A.page)}`);
check("US5-10 지운 답글 DB 내용 빈 글자", (await one("SELECT content FROM replies WHERE content = '' AND deleted_at IS NOT NULL AND author_id = $1 LIMIT 1", [uid.B]))?.content === "");

// US5-11 A가 자기 글에 단 답글 보상 없음
const aLedger = await ledger(uid.A);
await section(A.page).locator(`#comment-${root2.id}`).getByRole("button", { name: "답글", exact: true }).click();
await section(A.page).locator(`#comment-${root2.id} form textarea`).fill("주인의 답글");
await section(A.page).locator(`#comment-${root2.id}`).getByRole("button", { name: "답글 등록" }).click();
await section(A.page).locator('[id^="reply-"]', { hasText: "주인의 답글" }).waitFor();
check("US5-11 내 글에 단 답글 보상 없음", (await ledger(uid.A)) === aLedger);

// SC-004 하루 10번: D가 댓글 6 + 답글 5 → 원장 comment 10행
const D = await member(ids.D);
const uidD = await userId(ids.D);
for (let i = 0; i < 6; i++) {
  await D.page.goto(url(P));
  await write(D.page, `D 댓글 ${i}`);
  await commentLine(D.page, `D 댓글 ${i}`).waitFor();
}
for (let i = 0; i < 5; i++) {
  const line = section(D.page).locator(`#comment-${root2.id}`);
  await line.getByRole("button", { name: "답글", exact: true }).click();
  await line.locator("form textarea").fill(`D 답글 ${i}`);
  await line.getByRole("button", { name: "답글 등록" }).click();
  await section(D.page).locator('[id^="reply-"]', { hasText: `D 답글 ${i}` }).waitFor();
}
check("SC-004 댓글 6 + 답글 5 → 보상 원장 10행", (await ledger(uidD)) === 10, String(await ledger(uidD)));
check("SC-004 11개 모두 저장", (await count("SELECT ((SELECT count(*) FROM comments WHERE author_id = $1) + (SELECT count(*) FROM replies WHERE author_id = $1))::int AS n", [uidD])) === 11);

// 글 삭제 → 댓글·답글 행 0 (CASCADE)
await db.query("INSERT INTO replies (comment_id, author_id, content) VALUES ($1, $2, 'P2 답글')", [p2Comment.id, uid.B]);
await db.query("DELETE FROM posts WHERE id = $1", [P2]);
check("글 삭제 → 그 글의 댓글·답글 행 0",
  (await count("SELECT count(*)::int AS n FROM comments WHERE post_id = $1", [P2])) === 0 &&
  (await count("SELECT count(*)::int AS n FROM replies WHERE comment_id = $1", [p2Comment.id])) === 0);

// DB 직접: 삭제 행에 내용 → 23514
const violation = await db.query("UPDATE replies SET content = '남김' WHERE deleted_at IS NOT NULL AND author_id = $1", [uid.B]).then(() => "ok").catch((e) => e.code);
check("CHECK: 삭제한 답글에 내용 넣기 → 23514", violation === "23514", violation);
const cViolation = await db.query("UPDATE comments SET content = '남김' WHERE id = $1", [cRow.id]).then(() => "ok").catch((e) => e.code);
check("CHECK: 삭제한 댓글에 내용 넣기 → 23514", cViolation === "23514", cViolation);

// 키보드만으로 댓글 등록
await C.page.goto(url(P));
await mainForm(C.page).locator("textarea").focus();
await C.page.keyboard.type("키보드 댓글");
await C.page.keyboard.press("Tab");
await C.page.keyboard.press("Enter");
check("키보드만으로 댓글 등록", await commentLine(C.page, "키보드 댓글").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));

// 375px: 가로 스크롤 0, 버튼 44px·한 줄
await C.page.setViewportSize({ width: 375, height: 800 });
await C.page.goto(url(P));
await section(C.page).locator(`#comment-${root2.id}`).getByRole("button", { name: "답글", exact: true }).click();
const overflow = await C.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375px 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
const sizes = [];
for (const loc of [
  section(C.page).getByRole("button", { name: "답글 취소" }),
  section(C.page).getByRole("button", { name: "답글 등록" }),
  section(C.page).getByRole("button", { name: "댓글 등록" }),
  section(C.page).getByRole("button", { name: "삭제", exact: true }).first(),
  section(C.page).locator('[id^="comment-"] a').first(),
]) {
  const box = await loc.boundingBox();
  sizes.push(box ? `${Math.round(box.width)}×${Math.round(box.height)}` : "없음");
}
check("375px [답글 취소]·[답글 등록]·[댓글 등록]·[삭제]·닉네임 ≥ 44px 높이", sizes.every((s) => s !== "없음" && Number(s.split("×")[1]) >= 44), sizes.join(", "));
const wrapped = await section(C.page).getByRole("button").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 60).map((e) => e.textContent));
check("375px 버튼 글자 한 줄", wrapped.length === 0, wrapped.join(","));
await C.page.screenshot({ path: `${outDir}/comments-375.png`, fullPage: true });
await B.page.goto(url(P));
await B.page.screenshot({ path: `${outDir}/comments-pc.png`, fullPage: true });

const allErrors = [...A.errors, ...B.errors, ...C.errors].filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", allErrors.length === 0, allErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
