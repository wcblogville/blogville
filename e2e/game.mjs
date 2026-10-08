// 상점 → 꾸미기 흐름 (출석은 자동 출석이라 e2e/attendance.mjs가 확인한다)
import { chromium } from "@playwright/test";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const NAME = `gm${Date.now().toString(36)}`; // 실행마다 새 회원
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, NAME, "남자 주민");
console.log("start coins (가입 100 + 1일차 출석 10):", await coins(page));

// 상점: 바닷가 배경(120, Lv1) 사기, 토끼(Lv2)는 잠김
await page.goto(`${BASE}/shop`);
const beach = page.locator("article", { hasText: "바닷가" });
await beach.getByRole("button", { name: "사기" }).click();
await page.getByRole("status").waitFor();
console.log("shop msg:", await page.getByRole("status").innerText());
console.log("rabbit button:", await page.locator("article", { hasText: "토끼" }).getByRole("button").innerText());
await page.waitForLoadState("networkidle");
console.log("after purchase:", await coins(page));
await page.screenshot({ path: `${outDir}/21-shop.png`, fullPage: true });

// 꾸미기: 바닷가 장착 → 블로그 미니룸 확인
await page.goto(`${BASE}/closet`);
await page.getByRole("button", { name: /바닷가/ }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/22-closet.png`, fullPage: true });
await page.goto(`${BASE}/@${NAME}`);
await page.screenshot({ path: `${outDir}/23-blog-beach.png` });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
