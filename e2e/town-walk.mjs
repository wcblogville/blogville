// 광장 걷기 (사용자 요청 2026-10-16): 처음부터 제 속도로 걷기, 누른 곳까지 막힌 길을 돌아 걷기, 들어갔다 나오면 들어간 자리로
// 사용: 개발 서버를 띄운 상태에서 node e2e/town-walk.mjs <스크린샷 폴더>
// 요구사항: TOWN-02 누른 곳까지 길 찾기, TOWN-03 들어간 자리로 나오기
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, `tw${Date.now() % 100_000_000}`);

const canvas = page.locator("canvas");
const ready = async () => {
  await canvas.waitFor();
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.feet, null, { timeout: 20000 });
};
const data = async (k) => canvas.getAttribute(`data-${k}`);
const feet = async () => ((await data("feet")) ?? "0,0").split(",").map(Number);
const teleport = (key) => canvas.evaluate((c, k) => c.dispatchEvent(new CustomEvent("bv-teleport", { detail: k })), key);
const near = (a, b, d) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= d;

await page.goto(`${BASE}/town`);
await ready();

// ── 1. 처음부터 제 속도 (예전에는 처음 120프레임 동안 몇 배 느렸다): 분수 앞에서 0.6초 오른쪽으로 → 230px/초의 절반 넘게 ──
await teleport("plaza");
await page.waitForTimeout(100);
const s0 = await feet();
await page.keyboard.down("ArrowRight");
const t0 = Date.now();
await page.waitForTimeout(600);
await page.keyboard.up("ArrowRight");
const secs = (Date.now() - t0) / 1000;
const s1 = await feet();
const speed = (s1[0] - s0[0]) / secs;
check("처음 걸음도 제 속도 (초당 115px 넘게)", speed > 115, `${Math.round(speed)}px/초`);

// ── 2. 누른 곳까지 길 찾기: 분수 앞(남쪽)에서 분수 뒤(북쪽)를 누르면 분수를 돌아서 간다 ──
await teleport("plaza");
await page.waitForTimeout(200);
const [px, py] = await feet();
const goal = [px, py - 290];
const [camX, camY] = ((await data("cam")) ?? "0,0").split(",").map(Number);
const box = await canvas.boundingBox();
await page.mouse.click(box.x + goal[0] - camX, box.y + goal[1] - camY);
await page.waitForTimeout(100);
const turns = Number(await data("route"));
check("분수 너머를 누르면 꺾는 점이 있는 길 (곧장 가면 분수에 막힌다)", turns >= 2, String(turns));
const arrived = await page
  .waitForFunction(([gx, gy]) => {
    const [x, y] = (document.querySelector("canvas")?.dataset.feet ?? "0,0").split(",").map(Number);
    return Math.hypot(x - gx, y - gy) < 14;
  }, goal, { timeout: 15000 })
  .then(() => true, () => false);
check("분수를 돌아 누른 곳에 닿는다", arrived, `${await data("feet")} → ${goal}`);
await page.screenshot({ path: `${outDir}/town-walk-path.png` });

// ── 3. 상점 앞에서 상점에 들어갔다가 [나가기] → 상점 앞에 다시 선다 ──
await teleport("shop");
await page.waitForTimeout(300);
const atShop = await feet();
await page.goto(`${BASE}/shop`);
await page.getByRole("link", { name: /나가기/ }).click();
await page.waitForURL(/\/town$/);
await ready();
const back = await feet();
check("상점에서 나오면 들어간 자리 (상점 앞)", near(back, atShop, 12), `${atShop} → ${back}`);

// 새로 고침해도 그 자리, ?at=으로 오면 그 집 앞이 먼저
await page.reload();
await ready();
check("새로 고침해도 그 자리", near(await feet(), atShop, 12), String(await feet()));
await page.screenshot({ path: `${outDir}/town-walk-return.png` });

// 다른 탭(새 창)은 처음 자리에서 시작 (sessionStorage는 탭마다)
const other = await ctx.newPage();
await other.goto(`${BASE}/town`);
await other.locator("canvas").waitFor();
await other.waitForFunction(() => document.querySelector("canvas")?.dataset.feet, null, { timeout: 20000 });
const otherFeet = ((await other.locator("canvas").getAttribute("data-feet")) ?? "0,0").split(",").map(Number);
check("새 탭은 광장 아래쪽에서 시작", !near(otherFeet, atShop, 100), String(otherFeet));
await other.close();

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
