// 글 정렬·사진 크기 (사용자 요청 2026-10-16 "왼쪽·오른쪽·중앙 정렬 선택, 사진 중앙 정렬도", "첨부한 사진 크기 조절"): 글 줄과 사진을 가운데·오른쪽으로, 사진은 작게·보통·크게, 저장 뒤에도 그대로
// 사용: 개발 서버를 띄운 상태에서 node e2e/post-align.mjs <스크린샷 폴더>
// 요구사항: POST-01 글쓰기
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
const errors = collectErrors(page);
await loginDev(page, `al${Date.now() % 100_000_000}`);
const PHOTO = await page.screenshot({ clip: { x: 0, y: 0, width: 300, height: 160 } });
const tool = (name) => page.locator(`[data-tool="${name}"]`);

await page.goto(`${BASE}/write`);
const editor = page.locator(".ProseMirror");
await editor.waitFor();
await page.getByPlaceholder("제목").fill("정렬 확인용 글");
await editor.click();
await page.keyboard.type("왼쪽 줄");
await page.keyboard.press("Enter");
await page.keyboard.type("가운데 줄");
await tool("가운데 정렬").click();
check("가운데 정렬 버튼 눌림", (await tool("가운데 정렬").getAttribute("aria-pressed")) === "true");
await page.keyboard.press("Enter");
await page.keyboard.type("오른쪽 줄");
await tool("오른쪽 정렬").click();
check("에디터: 가운데·오른쪽 줄", (await editor.locator('p[style*="text-align: center"]').innerText()) === "가운데 줄" && (await editor.locator('p[style*="text-align: right"]').innerText()) === "오른쪽 줄");
await page.keyboard.press("Enter");
await tool("왼쪽 정렬").click();

// 사진: 올린 뒤 사진을 눌러 고르고 [가운데]
await page.getByLabel("사진 고르기").setInputFiles([{ name: "광장.png", mimeType: "image/png", buffer: PHOTO }]);
const img = editor.locator("img").first();
await img.waitFor({ timeout: 30000 });
await page.getByText(/올리는 중/).waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
await img.click();
await tool("가운데 정렬").click();
check("에디터: 사진 가운데", (await img.getAttribute("data-align")) === "center");
const box = await img.boundingBox();
const area = await editor.boundingBox();
check("사진이 가운데에 그려짐", Math.abs(box.x + box.width / 2 - (area.x + area.width / 2)) < 30, `${Math.round(box.x + box.width / 2)} vs ${Math.round(area.x + area.width / 2)}`);
// 사진 크기: 사진을 고르면 크기 줄이 나오고 [보통]이면 본문 너비의 절반
const sizeBar = page.locator("[data-image-size-bar]");
check("사진을 고르면 크기 줄", await sizeBar.isVisible());
const before = (await img.boundingBox()).width;
await sizeBar.getByRole("button", { name: "보통" }).click();
check("에디터: 사진 data-size=m", (await img.getAttribute("data-size")) === "m");
await page.locator("[data-rich-editor]").screenshot({ path: `${outDir}/post-align-editor.png` });
const half = (await img.boundingBox()).width;
const inner = await editor.evaluate((el) => el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(el).paddingRight));
check("보통 = 본문 너비의 절반", Math.abs(half - inner / 2) < 4 || half === before, `${before} → ${half}, 본문 ${inner}`);
await editor.locator("p").first().click();
check("글자를 누르면 크기 줄 사라짐", await sizeBar.waitFor({ state: "hidden", timeout: 5000 }).then(() => true, () => false));


await page.getByRole("button", { name: "발행하기" }).click();
await page.waitForURL(/\/@[a-z0-9_]+\/\d+/);
const id = Number(new URL(page.url()).pathname.match(/\/(\d+)$/)[1]);
const { content } = (await db.query("SELECT content_html AS content FROM posts WHERE id = $1", [id])).rows[0];
check("저장: 가운데·오른쪽 줄", content.includes('<p style="text-align:center">가운데 줄</p>') && content.includes('<p style="text-align:right">오른쪽 줄</p>'), content.slice(0, 200));
check("저장: 사진 정렬·크기", /<img [^>]*data-align="center" data-size="m"/.test(content), content.match(/<img[^>]*>/)?.[0]);
const shown = page.locator("article .prose-blog, .prose-blog").first();
check("글 화면: 가운데 줄", (await shown.locator('p[style*="text-align:center"], p[style*="text-align: center"]').count()) === 1);
check("글 화면: 사진 가운데·보통", (await shown.locator('img[data-align="center"][data-size="m"]').count()) === 1);
await page.screenshot({ path: `${outDir}/post-align-view.png`, fullPage: true });

// 고치기 화면에서도 정렬이 남아 있다
await page.goto(`${BASE}/write/${id}`);
await editor.waitFor();
check("고치기: 정렬 그대로", (await editor.locator('p[style*="text-align: center"]').count()) === 1 && (await editor.locator('img[data-align="center"]').count()) === 1);

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
