// 글꼴 색·바탕색·이모티콘과 태그 순서 (사용자 요청 2026-10-12)
// 사용: 개발 서버를 띄운 상태에서 node e2e/editor-tags.mjs <스크린샷 폴더>
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
mkdirSync(outDir, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
const id = `edt${Date.now() % 100_000_000}`;
await loginDev(page, id);

const editor = page.locator(".ProseMirror");
const toolbar = page.getByRole("toolbar", { name: "글꼴 도구" });
const chips = () => page.locator("[data-tag-order] [data-tag-chip]").evaluateAll((els) => els.map((e) => e.getAttribute("data-tag-chip")));
const postIdOf = () => Number(new URL(page.url()).pathname.match(/\/(\d+)$/)[1]);
const postTags = async (postId) =>
  (await db.query("SELECT t.name FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = $1 ORDER BY pt.position", [postId])).rows.map((r) => r.name);
const shownTags = () => page.locator("article ul a[href^='/tags/']").allInnerTexts();

// ── 글꼴 색 · 바탕색 · 이모티콘 ──
await page.goto(`${BASE}/write`);
await editor.waitFor();
await page.getByPlaceholder("제목").fill("색과 이모티콘");
await editor.click();
// 세 줄을 먼저 쓰고, 줄마다 골라서 색을 칠한다 (색은 Enter 뒤에도 이어지므로)
await page.keyboard.type("빨간 글자");
await page.keyboard.press("Enter");
await page.keyboard.type("노란 형광펜");
await page.keyboard.press("Enter");
await page.keyboard.type("오늘 기분 ");
await editor.locator("p").nth(0).click({ clickCount: 3 });
await toolbar.getByRole("button", { name: "글꼴 색" }).click();
await page.locator("[data-palette=color]").waitFor();
await page.screenshot({ path: `${outDir}/01-text-color-palette.png` });
await page.getByRole("button", { name: "글꼴 색 빨강" }).click();
check("글꼴 색 창은 고르면 닫힘", (await page.locator("[data-palette]").count()) === 0);
check("에디터에 빨강 글자", (await editor.locator("p").nth(0).locator("span").evaluate((el) => getComputedStyle(el).color)) === "rgb(214, 60, 60)");

await editor.locator("p").nth(1).click({ clickCount: 3 });
await toolbar.getByRole("button", { name: "글꼴 바탕색" }).click();
await page.locator("[data-palette=highlight]").waitFor();
await page.screenshot({ path: `${outDir}/02-highlight-palette.png` });
await page.getByRole("button", { name: "바탕색 노랑" }).click();
check("에디터에 바탕색 mark", (await editor.locator("mark").first().getAttribute("data-color")) === "#fff176");

// 키보드: 버튼에서 Enter로 열고, 창 안 칸에 포커스, Esc로 닫으면 버튼으로 돌아온다
await toolbar.getByRole("button", { name: "글꼴 색" }).focus();
await page.keyboard.press("Enter");
await page.locator("[data-palette=color]").waitFor();
const focusedInPanel = await page.evaluate(() => Boolean(document.activeElement?.closest("[data-palette]")));
await page.keyboard.press("Escape");
const backOnTrigger = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
check("키보드: 열면 창 안 포커스, Esc면 버튼으로", focusedInPanel && backOnTrigger === "글꼴 색" && (await page.locator("[data-palette]").count()) === 0, backOnTrigger ?? "");

await editor.click();
await page.keyboard.press("Control+End");
await toolbar.getByRole("button", { name: "이모티콘" }).click();
await page.locator("[data-palette=emoji]").waitFor();
await page.getByRole("button", { name: "이모티콘 😀 넣기" }).click();
await page.getByRole("tab", { name: "동물·자연" }).click();
await page.screenshot({ path: `${outDir}/03-emoji-picker.png` });
await page.getByRole("button", { name: "이모티콘 🐶 넣기" }).click();
await page.keyboard.press("Escape");
check("이모티콘이 커서 자리에", (await editor.locator("p").last().innerText()) === "오늘 기분 😀🐶", await editor.locator("p").last().innerText());

// ── 태그 순서 ──
const tagInput = page.getByLabel("태그", { exact: true });
await tagInput.fill("zeta, alpha, 중간");
check("칩은 적은 순서", JSON.stringify(await chips()) === JSON.stringify(["zeta", "alpha", "중간"]), (await chips()).join(","));
await page.getByRole("button", { name: "#중간 앞으로" }).click();
check("◀ 로 앞으로", JSON.stringify(await chips()) === JSON.stringify(["zeta", "중간", "alpha"]) && (await tagInput.inputValue()) === "zeta, 중간, alpha", await tagInput.inputValue());
// 키보드: 버튼에 포커스하고 Enter, 옮긴 뒤에도 같은 태그 버튼에 포커스
await page.getByRole("button", { name: "#zeta 뒤로" }).focus();
await page.keyboard.press("Enter");
const focusAfterMove = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
check("키보드로 ▶, 포커스 유지", JSON.stringify(await chips()) === JSON.stringify(["중간", "zeta", "alpha"]) && focusAfterMove === "#zeta 뒤로", `${(await chips()).join(",")} / ${focusAfterMove}`);
await page.getByRole("button", { name: "#zeta 뒤로" }).scrollIntoViewIfNeeded();
await page.screenshot({ path: `${outDir}/04-tag-order.png`, fullPage: true });

await page.getByRole("button", { name: "발행하기" }).click();
await page.waitForURL(/\/@[a-z0-9_]+\/\d+/);
const postId = postIdOf();
check("저장 순서 = 화면 순서 (DB position)", JSON.stringify(await postTags(postId)) === JSON.stringify(["중간", "zeta", "alpha"]), (await postTags(postId)).join(","));
check("글 화면 태그 순서", JSON.stringify(await shownTags()) === JSON.stringify(["#중간", "#zeta", "#alpha"]), (await shownTags()).join(","));

// 글 화면에 색이 보인다
const body = page.locator("article .prose-blog");
const red = await body.locator('span[style*="color"]').first().evaluate((el) => getComputedStyle(el).color);
const markBg = await body.locator("mark").first().evaluate((el) => getComputedStyle(el).backgroundColor);
check("글 화면 글꼴 색", red === "rgb(214, 60, 60)", red);
check("글 화면 바탕색", markBg === "rgb(255, 241, 118)", markBg);
check("글 화면 이모티콘", (await body.innerText()).includes("오늘 기분 😀🐶"));
const saved = (await one("SELECT content_html FROM posts WHERE id = $1", [postId])).content_html;
check("저장 HTML", saved.includes('<span style="color:#d63c3c">빨간 글자</span>') && saved.includes('<mark data-color="#fff176" style="background-color:#fff176;color:inherit">노란 형광펜</mark>'), saved);
await body.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${outDir}/05-post-colors.png`, fullPage: true });

// ── 수정 화면: 순서와 색이 그대로, 다시 바꿔 저장 ──
await page.goto(`${BASE}/write/${postId}`);
await editor.waitFor();
check("수정 화면 태그 순서", (await tagInput.inputValue()) === "중간, zeta, alpha", await tagInput.inputValue());
check(
  "수정 화면 색 그대로",
  (await editor.locator("span[style]").evaluateAll((els) => els.map((e) => getComputedStyle(e).color)).then((c) => c.join())) === "rgb(214, 60, 60)" &&
    (await editor.locator('mark[data-color="#fff176"]').count()) === 1,
);
await page.getByRole("button", { name: "#alpha 앞으로" }).click();
await page.getByRole("button", { name: "#alpha 앞으로" }).click();
// 새 태그를 끝에 더한다
await tagInput.fill(`${await tagInput.inputValue()}, 새태그`);
await page.getByRole("button", { name: "수정 완료" }).click();
await page.waitForURL(new RegExp(`/@[a-z0-9_]+/${postId}$`));
check("고친 순서 저장", JSON.stringify(await postTags(postId)) === JSON.stringify(["alpha", "중간", "zeta", "새태그"]), (await postTags(postId)).join(","));
check("고친 순서 글 화면", JSON.stringify(await shownTags()) === JSON.stringify(["#alpha", "#중간", "#zeta", "#새태그"]), (await shownTags()).join(","));
const savedAgain = (await one("SELECT content_html FROM posts WHERE id = $1", [postId])).content_html;
check("다시 저장해도 색 그대로", savedAgain.includes('<span style="color:#d63c3c">') && savedAgain.includes('<mark data-color="#fff176"'));

// ── 위험한 style은 저장할 때 빠진다 (폼의 본문 값을 직접 바꿔 보낸다) ──
await page.goto(`${BASE}/write`);
await editor.waitFor();
await page.getByPlaceholder("제목").fill("나쁜 스타일");
await editor.click();
await page.keyboard.type("본문");
const evil =
  '<p><span style="color:#d63c3c; position:fixed; top:0; background:url(https://evil.example/x.png)">악성</span>' +
  '<mark style="background-color: expression(alert(1))" onclick="alert(1)">식</mark>' +
  '<span style="color: url(javascript:alert(1))">글</span><b style="font-size:99px">자</b></p>';
await page.evaluate((html) => {
  document.querySelector('input[name="contentHtml"]').value = html;
}, evil);
await page.getByRole("button", { name: "발행하기" }).click();
await page.waitForURL(/\/@[a-z0-9_]+\/\d+/);
const evilSaved = (await one("SELECT content_html FROM posts WHERE id = $1", [postIdOf()])).content_html;
check(
  "위험한 style 제거",
  !/position|url\(|expression|onclick|font-size|javascript/i.test(evilSaved) && evilSaved.includes('<span style="color:#d63c3c">악성</span>') && evilSaved.includes("<mark>식</mark>"),
  evilSaved,
);

// ── 휴대폰 폭: 팔레트가 화면 밖으로 넘치지 않는다 ──
const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
const mp = await phone.newPage();
collectErrors(mp);
await mp.goto(`${BASE}/write`);
await mp.locator(".ProseMirror").waitFor();
await mp.getByRole("toolbar", { name: "글꼴 도구" }).getByRole("button", { name: "이모티콘" }).click();
const box = await mp.locator("[data-palette=emoji]").boundingBox();
const scrollW = await mp.evaluate(() => document.documentElement.scrollWidth);
check("휴대폰: 이모티콘 창이 화면 안", box && box.x >= 0 && box.x + box.width <= 375 && scrollW <= 375, `${JSON.stringify(box)} scrollW=${scrollW}`);
await mp.screenshot({ path: `${outDir}/06-mobile-emoji.png` });
await mp.getByRole("button", { name: "닫기 (Esc)" }).click();
await mp.getByRole("toolbar", { name: "글꼴 도구" }).getByRole("button", { name: "글꼴 색" }).click();
await mp.screenshot({ path: `${outDir}/07-mobile-color.png` });
await phone.close();

check("화면 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
