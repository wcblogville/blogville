// 첨부를 글에 잇기·공개 범위·붙여 넣기 다시 올리기·정리 작업 (POST-02·POST-07·POST-09 / US3-8, US8, US9, SC-011, SC-013)
// 사용: 개발 서버를 띄운 상태에서 node e2e/attachment-links.mjs <스크린샷 폴더>
// 실행마다 새 회원 A·B를 만든다. 정리 작업은 npm run posts:cleanup을 직접 돌린다
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "storage/uploads");

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const ctxA = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const ctxB = await browser.newContext();
const ctxGuest = await browser.newContext();
const a = await ctxA.newPage();
const b = await ctxB.newPage();
const guest = await ctxGuest.newPage();
const errors = collectErrors(a);
const n = Date.now() % 100_000_000;
const idA = `ala${n}`;
const idB = `alb${n}`;
await loginDev(a, idA);
await loginDev(b, idB);
await guest.goto(BASE);

// PNG 머리 + 무작위 바이트 (서버는 앞부분만 본다)
const pngBytes = () => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 64 }, () => Math.floor(Math.random() * 256))];
/** page의 회원으로 파일 하나를 올린다 → { key, url, kind, name, size } */
const upload = (page, name, bytes, type) =>
  page.evaluate(
    async ({ name, bytes, type }) => {
      const fd = new FormData();
      fd.append("file", new File([new Uint8Array(bytes)], name, { type }));
      return (await fetch("/api/uploads", { method: "POST", body: fd })).json();
    },
    { name, bytes, type },
  );
const status = (page, key, headers = {}) => page.evaluate(async ({ key, headers }) => (await fetch(`/files/${key}`, { headers })).status, { key, headers });
const row = (key) => one("SELECT post_id, detached_at, user_id, name, size FROM attachments WHERE key = $1", [key]);
const postIdOf = (page) => Number(new URL(page.url()).pathname.match(/\/(\d+)$/)[1]);

async function openWrite(page, postId) {
  await page.goto(`${BASE}/write${postId ? `/${postId}` : ""}`);
  await page.locator(".ProseMirror").waitFor();
}
/** 에디터에 HTML을 붙여 넣는다 (Ctrl+V와 같은 경로) */
async function paste(page, html) {
  // 맨 앞 문단 끝에 커서를 둔다 (사진을 눌러 고른 채 붙여 넣으면 사진을 바꿔 넣는다)
  await page.locator(".ProseMirror p").first().click();
  await page.keyboard.press("End");
  await page.locator(".ProseMirror").evaluate((el, html) => {
    const dt = new DataTransfer();
    dt.setData("text/html", html);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, html);
  // 판정·다시 올리기가 끝날 때까지
  await page.waitForFunction(() => !document.body.innerText.includes("올리는 중..."), null, { timeout: 15000 });
  await page.waitForTimeout(500);
}
/** 발행 버튼을 누르기 직전에 폼으로 보낼 본문을 바꾼다 (화면을 거치지 않은 조작) */
const forceContent = (page, html) => page.locator('input[name="contentHtml"]').evaluate((el, html) => (el.value = html), html);
async function publish(page, { title, html, visibility = "public", force }) {
  await openWrite(page);
  await page.getByPlaceholder("제목").fill(title);
  if (visibility === "private") await page.getByRole("radio", { name: "🔒 비공개" }).click();
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(`${title} 본문`);
  if (html) await paste(page, html);
  if (force) await forceContent(page, force);
  await page.getByRole("button", { name: "발행하기" }).click();
  await page.waitForURL(/\/@[a-z0-9_]+\/\d+/);
  return postIdOf(page);
}
const contentOf = async (id) => (await one("SELECT content_html FROM posts WHERE id = $1", [id])).content_html;

// ── 준비: A의 사진 3장·파일 1개, B의 사진 1장 ──
const img1 = await upload(a, "비밀.png", pngBytes(), "image/png");
const img2 = await upload(a, "공개.png", pngBytes(), "image/png");
const img3 = await upload(a, "다시.png", pngBytes(), "image/png");
const pdfBytes = Array.from(Buffer.from("%PDF-1.4 보고서 내용"));
const pdf = await upload(a, "보고서 (최종) \"수정\".pdf", pdfBytes, "application/pdf");
const imgB = await upload(b, "남의.png", pngBytes(), "image/png");
check("올린 첨부는 어느 글에도 안 붙음", (await row(img1.key)).post_id === null);
check("붙지 않은 첨부: 올린 사람 200", (await status(a, img1.key)) === 200);
check("붙지 않은 첨부: 다른 회원 404", (await status(b, img1.key)) === 404);
check("붙지 않은 첨부: 방문자 404", (await status(guest, img1.key)) === 404);

// ── US3-8 비공개 글 첨부는 주인만 ──
const secret = await publish(a, { title: "비공개 사진 글", html: `<p>사진</p><img src="${img1.url}">`, visibility: "private" });
check("비공개 글 저장 → 첨부가 그 글에 붙음", (await row(img1.key)).post_id === secret);
check("US3-8 비공개 글 첨부: 주인 200", (await status(a, img1.key)) === 200);
check("US3-8 비공개 글 첨부: 다른 회원 404", (await status(b, img1.key)) === 404);
check("US3-8 비공개 글 첨부: 방문자 404", (await status(guest, img1.key)) === 404);
await db.query("UPDATE users SET role = 'admin' WHERE username = $1", [idB]);
check("US3-8 비공개 글 첨부: 관리자도 404", (await status(b, img1.key)) === 404);
await db.query("UPDATE users SET role = 'user' WHERE username = $1", [idB]);

// ── 공개 글: 사진 + 파일 카드 ──
const card = (f, over = {}) => `<a href="${f.url}" data-file="" data-name="${over.name ?? f.name}" data-size="${over.size ?? f.size}"></a>`;
const pub = await publish(a, { title: "공개 첨부 글", html: `<img src="${img2.url}">${card(pdf)}` });
check("공개 글 첨부: 방문자 200", (await status(guest, img2.key)) === 200 && (await status(guest, pdf.key)) === 200);
const res = await guest.evaluate(async (k) => {
  const r = await fetch(`/files/${k}`);
  return { cache: r.headers.get("cache-control"), etag: r.headers.get("etag"), disposition: r.headers.get("content-disposition"), body: await r.text() };
}, pdf.key);
check("캐시 머리글 private, no-cache + ETag", res.cache === "private, no-cache" && res.etag === `"${pdf.key}"`, `${res.cache} ${res.etag}`);
check("If-None-Match → 304", (await status(guest, pdf.key, { "If-None-Match": `"${pdf.key}"` })) === 304);
check("If-None-Match여도 권한 없으면 404", (await status(guest, img1.key, { "If-None-Match": `"${img1.key}"` })) === 404);
const encodedName = encodeURIComponent(pdf.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const asciiName = pdf.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
check("US9 원래 이름(한글·괄호·따옴표)으로 내려받기 머리글", res.disposition === `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`, res.disposition);
check("US9 내려받은 내용이 올린 것과 같음", res.body === "%PDF-1.4 보고서 내용");

// ── US9-6 카드 이름·크기 조작 → 처음 올린 값으로 저장 ──
const pdf2 = await upload(a, "원래 이름.pdf", pdfBytes, "application/pdf");
const forged = await publish(a, { title: "카드 조작", force: `<p>카드</p>${card(pdf2, { name: "가짜.exe", size: 1 })}` });
const forgedHtml = await contentOf(forged);
check("US9-6 카드 이름·크기는 처음 올린 값", forgedHtml.includes('data-name="원래 이름.pdf"') && forgedHtml.includes(`data-size="${pdf2.size}"`) && !forgedHtml.includes("가짜"));

// ── US8-8 저장 때 빠지는 주소 (화면을 거치지 않은 조작) ──
const evil = await publish(a, {
  title: "빠지는 주소",
  force:
    `<p>본문</p><img src="https://evil.example/x.png"><img src="data:image/png;base64,AAAA">` +
    `<img src="/files/${"0".repeat(32)}"><img src="${imgB.url}"><img src="${img1.url}">`,
});
const evilHtml = await contentOf(evil);
check("US8-8 다른 사이트·내장 데이터·없는·남의·다른 글 첨부 주소가 빠짐", !/<img/.test(evilHtml), evilHtml);
check("US8-8 원래 글 첨부는 그대로", (await row(img1.key)).post_id === secret && (await row(imgB.key)).post_id === null);

// ── US8-10 / US9-9 내 다른 글 사진·파일 카드 붙여 넣기 → 새 첨부로 다시 올리기 ──
const re = await publish(a, { title: "붙여 넣기", html: `<img src="${img2.url}">${card(pdf)}<img src="${imgB.url}"><img src="/files/${"1".repeat(32)}">` });
const reHtml = await contentOf(re);
const reKeys = [...reHtml.matchAll(/\/files\/([a-f0-9]{32})/g)].map((m) => m[1]);
check("US8-10 남의 것·없는 키는 넣지 않음, 내 것 2개는 새 키", reKeys.length === 2 && !reKeys.includes(img2.key) && !reKeys.includes(pdf.key) && !reKeys.includes(imgB.key), reKeys.join(","));
const copies = await Promise.all(reKeys.map(row));
check("US8-10 새 첨부는 이 글에 붙음", copies.every((c) => c.post_id === re));
const copiedCard = copies.find((c) => c.name === pdf.name);
check("US9-9 파일 카드 다시 올리기: 같은 원래 이름·크기", Boolean(copiedCard) && copiedCard.size === pdf.size);
check("US8-10 원래 글 첨부 그대로", (await row(img2.key)).post_id === pub && (await row(pdf.key)).post_id === pub);
check("US9-9 원래 글 카드도 내려받아짐", (await status(guest, pdf.key)) === 200);
// SC-013 한 첨부가 두 글 본문에 붙은 경우 0
const shared = await one(
  `SELECT COUNT(*)::int AS c FROM posts p JOIN blogs bl ON bl.id = p.blog_id JOIN users u ON u.id = bl.owner_id
   JOIN attachments a ON position('/files/' || a.key IN p.content_html) > 0
   WHERE u.username = $1 AND a.post_id IS DISTINCT FROM p.id`,
  [idA],
);
check("SC-013 다른 글에 붙은 첨부를 본문에 가진 글 0", shared.c === 0, String(shared.c));

// ── 수정 화면에서 이 글 첨부를 다시 붙여 넣으면 그대로(keep) ──
await openWrite(a, pub);
await paste(a, `<img src="${img2.url}">`);
await a.getByRole("button", { name: "수정 완료" }).click();
await a.waitForURL(new RegExp(`/@${idA}/${pub}$`));
check("수정 화면: 이 글 첨부 붙여 넣기는 그대로", (await contentOf(pub)).split(img2.key).length - 1 === 2);

// ── US9-2 [📎 파일]로 사진을 고르면 사진으로 ──
await openWrite(a);
await a.getByLabel("파일 고르기").setInputFiles({ name: "파일로 고른 사진.png", mimeType: "image/png", buffer: Buffer.from(pngBytes()) });
await a.locator(".ProseMirror img").waitFor({ timeout: 15000 }).catch(() => {});
check("US9-2 파일 버튼으로 고른 사진 → 사진", (await a.locator(".ProseMirror img").count()) === 1);
await a.screenshot({ path: `${outDir}/attachment-links-editor.png` });

// ── 글에서 빼기·글 삭제 → 떨어짐(detached_at) ──
await openWrite(a, re);
// 사진을 눌러 고르고 지운다
await a.locator(".ProseMirror img").click();
await a.keyboard.press("Backspace");
await a.waitForTimeout(300);
await a.getByRole("button", { name: "수정 완료" }).click();
await a.waitForURL(new RegExp(`/@${idA}/${re}$`));
const removedImg = copies.find((c) => c.name !== pdf.name);
const removedKey = reKeys[copies.indexOf(removedImg)];
const removed = await row(removedKey);
check("본문에서 뺀 첨부는 떨어짐(detached_at)", removed.post_id === null && removed.detached_at !== null);
a.once("dialog", (d) => d.accept());
await a.goto(`${BASE}/@${idA}/${pub}`);
await a.getByRole("button", { name: "삭제" }).click();
await a.waitForURL(new RegExp(`/@${idA}$`));
const afterDelete = await row(img2.key);
check("글 삭제 → 첨부 떨어짐(detached_at)", afterDelete.post_id === null && afterDelete.detached_at !== null);
check("떨어진 첨부: 방문자 404", (await status(guest, img2.key)) === 404);

// ── 정리 작업 (SC-011) ──
await db.query("UPDATE attachments SET detached_at = now() - interval '25 hours' WHERE key = $1", [img2.key]);
await db.query("UPDATE attachments SET created_at = now() - interval '25 hours' WHERE key = $1", [img3.key]);
await db.query("UPDATE profiles SET photo_key = $2 WHERE user_id = (SELECT id FROM users WHERE username = $1)", [idA, pdf2.key]);
await db.query("UPDATE attachments SET post_id = NULL WHERE key = $1", [pdf2.key]);
await db.query("UPDATE attachments SET detached_at = now() - interval '25 hours' WHERE key = $1", [pdf2.key]);
const dry = execFileSync("npm", ["run", "-s", "posts:cleanup", "--", "--dry-run"], { encoding: "utf8" });
check("정리 --dry-run은 세기만", Boolean(await row(img2.key)) && dry.includes("(세기만)"), dry.trim().split("\n")[0]);
const out = execFileSync("npm", ["run", "-s", "posts:cleanup"], { encoding: "utf8" });
check("SC-011 하루 지난 붙지 않은 첨부 행 삭제", !(await row(img2.key)) && !(await row(img3.key)), out.trim().replace(/\n/g, " / "));
check("SC-011 저장소 파일도 삭제", !existsSync(path.join(uploadDir, img2.key)) && !existsSync(path.join(uploadDir, img3.key)));
check("프로필 사진은 지우지 않음", Boolean(await row(pdf2.key)));
check("최근 떨어진 첨부는 남음", Boolean(await row(removedKey)));
check("붙어 있는 첨부는 남음", Boolean(await row(img1.key)));

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
