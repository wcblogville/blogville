// 글 첨부: 사진(POST-07)·파일(POST-09)을 버튼·붙여 넣기·끌어다 놓기로 여러 개 올리고, 원래 이름으로 내려받는다
// 사용: 개발 서버를 띄운 상태에서 node e2e/attachments.mjs <스크린샷 폴더>  (실행마다 새 회원)
import { readFileSync } from "node:fs";
import http from "node:http";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);

// 테스트 파일 (진짜 PNG 1×1, PDF, 한글 파일 흉내, 확장자만 바꾼 SVG, 10MB 넘는 PNG)
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const HWP = Buffer.from("HWP Document File 테스트");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
const BIG = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
const file = (name, buffer, mimeType) => ({ name, mimeType, buffer });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
const errors = collectErrors(page);
await loginDev(page, `up${Date.now() % 100_000_000}`);
// 눈으로 확인할 수 있게 실제 크기의 사진(광장 화면을 찍은 PNG)도 쓴다
const PHOTO = await page.screenshot({ clip: { x: 0, y: 0, width: 800, height: 400 } });

await page.goto(`${BASE}/write`);
await page.locator(".ProseMirror").waitFor();
await page.getByPlaceholder("제목").fill("첨부 확인용 글");
await page.locator(".ProseMirror").click();
await page.keyboard.type("사진과 파일을 붙인 글");
const editorImages = () => page.locator(".ProseMirror img").count();
const editorCards = () => page.locator(".ProseMirror a[data-file]").count();
const idle = () => page.getByText(/올리는 중/).waitFor({ state: "detached", timeout: 30000 }).catch(() => {});

// 1) 버튼으로 사진 두 장을 한 번에
await page.getByLabel("사진 고르기").setInputFiles([file("광장.png", PHOTO, "image/png"), file("점.png", PNG, "image/png")]);
await page.waitForFunction(() => document.querySelectorAll(".ProseMirror img").length >= 2, null, { timeout: 30000 });
await idle();
check("버튼: 사진 2장을 한 번에", (await editorImages()) === 2);
// 넣은 직후 바로 글자를 쳐도 사진이 지워지지 않는다 (커서가 사진 뒤 글자 자리로 간다)
await page.keyboard.type("사진 다음 글");
check("올린 직후 글자를 쳐도 사진이 남음", (await editorImages()) === 2 && (await page.locator(".ProseMirror").innerText()).includes("사진 다음 글"));

// 2) 붙여 넣기(Ctrl+V)로 사진
const send = (mode, files) =>
  page.evaluate(
    ({ mode, files }) => {
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(new File([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], f.name, { type: f.type }));
      const el = document.querySelector(".ProseMirror");
      if (mode === "paste") el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      else {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.bottom - 10 }));
      }
    },
    { mode, files: files.map((f) => ({ name: f.name, type: f.mimeType, b64: f.buffer.toString("base64") })) },
  );
await send("paste", [file("스크린샷.png", PHOTO, "image/png")]);
await page.waitForFunction(() => document.querySelectorAll(".ProseMirror img").length >= 3, null, { timeout: 30000 });
await idle();
check("붙여 넣기: 사진", (await editorImages()) === 3);

// 3) 끌어다 놓기로 파일 두 개를 한 번에 (본문 아래쪽 빈 곳에 놓는다. 글 한가운데에 놓으면 그 자리에서 문단이 나뉜다)
await send("drop", [file("보고서 최종본.pdf", PDF, "application/pdf"), file("회의록.hwp", HWP, "")]);
await page.waitForFunction(() => document.querySelectorAll(".ProseMirror a[data-file]").length >= 2, null, { timeout: 30000 });
await idle();
check("끌어다 놓기: 파일 2개를 한 번에", (await editorCards()) === 2);

// 3-1) 붙여 넣은 HTML의 위험한 파일 카드(javascript:·다른 사이트 주소)는 카드가 되지 않는다
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.setData("text/html", '<a data-file data-name="보고서.pdf" data-size="1" href="javascript:document.title=1">x</a><a data-file data-name="a.pdf" href="https://evil.example/a.pdf">y</a>');
  dt.setData("text/plain", "xy");
  document.querySelector(".ProseMirror").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(300);
check("붙여 넣은 위험한 파일 카드는 카드가 되지 않음", (await editorCards()) === 2 && !(await page.locator('.ProseMirror a[href^="javascript:"]').count()));

// 4) 받지 않는 파일: 확장자만 바꾼 SVG(서버가 거부), 10MB 넘는 사진(브라우저가 거부), .exe(브라우저가 거부)
await page.getByLabel("사진 고르기").setInputFiles([file("가짜.png", SVG, "image/png"), file("큰사진.png", BIG, "image/png")]);
await page.getByText(/가짜\.png: 사진 파일이 아니에요/).waitFor({ timeout: 30000 });
await idle();
const notice = await page.getByRole("status").innerText();
check("확장자만 바꾼 SVG는 거부", notice.includes("가짜.png: 사진 파일이 아니에요"));
check("10MB 넘는 사진은 거부", notice.includes("큰사진.png: 사진은 10MB까지 올릴 수 있어요"));
await page.getByLabel("파일 고르기").setInputFiles([file("설치.exe", Buffer.from("MZ"), "application/octet-stream")]);
check("EXE는 거부", (await page.getByRole("status").innerText()).includes("설치.exe: 올릴 수 없는 형식이에요"));
check("거부된 파일은 본문에 들어가지 않음", (await editorImages()) === 3 && (await editorCards()) === 2);
await page.screenshot({ path: `${outDir}/attach-editor.png`, fullPage: true });

// 5) 발행 → 글 상세
await page.getByRole("button", { name: "발행하기" }).click();
await page.waitForURL(/\/@up\d+\/\d+/);
const postId = Number(new URL(page.url()).pathname.split("/").pop());
await page.waitForLoadState("networkidle");
const loaded = await page.locator(".prose-blog img").evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0).length);
check("글 상세: 사진 3장이 보임", loaded === 3, `${loaded}장`);
const cards = await page.locator(".prose-blog a[data-file]").evaluateAll((as) => as.map((a) => a.getAttribute("aria-label")));
check("글 상세: 파일 카드(이름·크기)", cards.length === 2 && cards[0].startsWith("보고서 최종본.pdf 내려받기 (") && cards[1].startsWith("회의록.hwp"), cards.join(" / "));
await page.screenshot({ path: `${outDir}/attach-post.png`, fullPage: true });
// 휴대폰(375px)에서도 가로 스크롤 없이 (NF-06)
await page.setViewportSize({ width: 375, height: 800 });
await page.waitForTimeout(300);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375px: 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
await page.screenshot({ path: `${outDir}/attach-post-375.png`, fullPage: true });
await page.setViewportSize({ width: 1100, height: 1000 });

// 6) 파일 카드를 누르면 원래 이름으로 내려받는다
const [download] = await Promise.all([page.waitForEvent("download"), page.locator(".prose-blog a[data-file]").first().click()]);
const savedPath = `${outDir}/download.pdf`;
await download.saveAs(savedPath);
check("내려받기: 원래 이름", download.suggestedFilename() === "보고서 최종본.pdf", download.suggestedFilename());
check("내려받기: 내용 그대로", readFileSync(savedPath).equals(PDF));

// 7) DB에는 주소만, 응답 머리글은 안전하게
const { rows } = await db.query("SELECT content_html, content_text FROM posts WHERE id = $1", [postId]);
check("DB 본문에는 /files/ 주소만 (data: 없음)", rows[0].content_html.includes("/files/") && !rows[0].content_html.includes("data:"));
check("첨부는 보상 글자 수에 들어가지 않음", rows[0].content_text.split(/\n+/).join("|") === "사진과 파일을 붙인 글|사진 다음 글|xy", JSON.stringify(rows[0].content_text));
const imgSrc = await page.locator(".prose-blog img").first().getAttribute("src");
const imgRes = await page.request.get(`${BASE}${imgSrc}`);
check("사진 응답: image/png·nosniff·화면에 표시", imgRes.headers()["content-type"] === "image/png" && imgRes.headers()["x-content-type-options"] === "nosniff" && imgRes.headers()["content-disposition"].startsWith("inline"));

// 8) 수정 화면에도 그대로
await page.goto(`${BASE}/write/${postId}`);
await page.locator(".ProseMirror").waitFor();
await page.waitForTimeout(500);
check("수정 화면: 사진·파일 카드가 그대로", (await editorImages()) === 3 && (await editorCards()) === 2);

// 9) 조작한 요청
const up = (ctx, name, buffer, headers = {}) =>
  ctx.post(`${BASE}/api/uploads`, { multipart: { file: { name, mimeType: "application/octet-stream", buffer } }, headers: { Origin: BASE, ...headers } });
check("다른 사이트에서 보낸 올리기 거부(403)", (await up(page.request, "a.png", PNG, { Origin: "https://evil.example" })).status() === 403);
check("확장자만 바꾼 SVG 직접 요청 거부(415)", (await up(page.request, "x.png", SVG)).status() === 415);
check("HTML 파일 직접 요청 거부(415)", (await up(page.request, "x.html", Buffer.from("<script>alert(1)</script>"))).status() === 415);
check("30MB 넘는 파일 직접 요청 거부(413)", (await up(page.request, "big.zip", Buffer.alloc(30 * 1024 * 1024 + 1))).status() === 413);
const anon = await browser.newContext();
check("로그인하지 않으면 거부(401)", (await up(anon.request, "a.png", PNG)).status() === 401);
await anon.close();
check("Origin: null 은 거부(403)", (await up(page.request, "a.png", PNG, { Origin: "null" })).status() === 403);
// 크기를 밝히지 않고 나눠 보내는 요청(chunked)은 본문을 읽기 전에 거부(411)
const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const chunked = await new Promise((resolve) => {
  const req = http.request(`${BASE}/api/uploads`, { method: "POST", headers: { Origin: BASE, Cookie: cookie, "Content-Type": "multipart/form-data; boundary=x", "Transfer-Encoding": "chunked" } }, (res) => resolve(res.statusCode));
  req.on("error", () => resolve(0));
  req.write("--x\r\n");
  req.end();
});
check("크기 정보 없는(chunked) 요청 거부(411)", chunked === 411, `HTTP ${chunked}`);
// 괄호·따옴표가 든 이름도 원래 이름으로 (RFC 8187)
const odd = await (await up(page.request, "철수's 발표 (최종).pdf", PDF)).json();
const oddRes = await page.request.get(`${BASE}${odd.url}`);
check("괄호·따옴표 이름도 filename*에 인코딩", oddRes.headers()["content-disposition"].includes("%27s%20%EB%B0%9C%ED%91%9C%20%28%EC%B5%9C%EC%A2%85%29.pdf"), oddRes.headers()["content-disposition"]);
check("없는 파일 주소는 404", (await page.request.get(`${BASE}/files/${"0".repeat(32)}`)).status() === 404);

// 일부러 거부시킨 가짜 SVG의 415 응답은 브라우저가 콘솔에 남기므로 뺀다
const unexpected = errors.filter((e) => !e.includes("status of 415"));
check("화면 오류 없음 (일부러 거부시킨 415 제외)", unexpected.length === 0, unexpected.join(" / "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
