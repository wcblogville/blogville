// 개발 서버(localhost:3000)를 대상으로 주요 흐름을 따라가며 스크린샷을 남긴다
// 사용: node e2e/flow.mjs <스크린샷 폴더> <개발용 아이디>
import { chromium } from "@playwright/test";

const outDir = process.argv[2] ?? "e2e-shots";
const devId = process.argv[3] ?? `tester${Date.now() % 100000}`;
const BASE = "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png` });

await page.goto(BASE);
await shot("01-landing");

// 개발용 로그인
await page.getByLabel("개발용 아이디").fill(devId);
await page.getByRole("button", { name: "입장" }).click();
// /town으로 갔다가 온보딩 전이면 /onboarding으로 다시 이동하므로, 최종 화면이 뜰 때까지 기다린다
await page.locator('canvas, input[name="nickname"]').first().waitFor({ timeout: 20000 });
console.log("after login:", page.url());

if (page.url().includes("onboarding")) {
  await shot("02-onboarding");
  await page.locator('input[name="nickname"]').fill(devId.slice(0, 12));
  await page.locator('input[name="blogTitle"]').fill(`${devId}의 블로그`);
  await page.locator('input[name="slug"]').fill(devId.toLowerCase());
  await page.locator("label", { hasText: "고양이" }).click();
  await page.getByRole("button", { name: /광장으로 출발/ }).click();
  await page.waitForURL(/town/);
}
console.log("town:", page.url());
await page.waitForSelector("canvas", { timeout: 15000 });
await page.waitForTimeout(1200);
await shot("03-town");

// 아래로 걸어가서 내 집 앞에 서기
await page.locator("canvas").click({ position: { x: 640, y: 200 } }).catch(() => {});
await page.keyboard.down("ArrowDown");
await page.waitForTimeout(900);
await page.keyboard.up("ArrowDown");
await page.waitForTimeout(400);
await shot("04-town-walk");

console.log("errors:", errors.length ? errors : "none");
await browser.close();
