// 출석(동시 클릭 포함) → 상점 → 꾸미기 흐름
import { chromium } from "@playwright/test";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, "gamer1", "남자 주민");
console.log("start coins:", await coins(page));

// 같은 계정으로 탭 두 개를 열어 출석 버튼을 동시에 누른다
const tab2 = await ctx.newPage();
await Promise.all([page.goto(`${BASE}/attendance`), tab2.goto(`${BASE}/attendance`)]);
await Promise.all([
  page.getByRole("button", { name: /출석하고/ }).click(),
  tab2.getByRole("button", { name: /출석하고/ }).click(),
]);
await page.waitForTimeout(1500);
const results = [await page.locator("main").innerText(), await tab2.locator("main").innerText()].map((t) =>
  t.includes("출석 완료") ? "완료" : t.includes("이미 출석") ? "이미" : "?",
);
console.log("동시 출석 결과:", results);
await page.screenshot({ path: `${outDir}/20-attendance.png`, fullPage: true });
await tab2.close();
await page.reload();
console.log("after attendance:", await coins(page));

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
await page.goto(`${BASE}/@gamer1`);
await page.screenshot({ path: `${outDir}/23-blog-beach.png` });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
