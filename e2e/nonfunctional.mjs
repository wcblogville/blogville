// 비기능 요구사항 측정: 모바일 가로 스크롤(NF-06), 페이지 응답 시간(NF-07)
// 사용: node e2e/nonfunctional.mjs <스크린샷 폴더> [BASE_URL]
// 속도는 프로덕션 빌드(next build && next start)를 대상으로 잰다
import { chromium } from "@playwright/test";

const outDir = process.argv[2] ?? "e2e-shots";
const BASE = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch();

// 로그인 (normal01은 auth.mjs가 만든 계정)
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE);
await page.getByLabel("아이디").fill("normal01");
await page.getByLabel("비밀번호", { exact: true }).fill("test-password-1234");
await page.getByRole("button", { name: "로그인", exact: true }).click();
await page.waitForURL(/town|onboarding/, { timeout: 20000 });

const slug = "normal01";
const pages = ["/town", "/feed", `/@${slug}`, "/write", "/shop", "/closet", "/attendance", "/settings/blog", "/wallet", "/farm"];

console.log("== NF-06 모바일(375px) 가로 스크롤");
for (const path of pages) {
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  const { scrollW, clientW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  const ok = scrollW <= clientW;
  console.log(`${ok ? "✅" : "❌"} ${path.padEnd(16)} 문서 너비 ${scrollW}px / 화면 ${clientW}px`);
  if (!ok || path === "/town" || path === `/@${slug}`) {
    await page.screenshot({ path: `${outDir}/m-${path.replace(/[^a-z0-9]/gi, "_")}.png`, fullPage: true });
  }
}

console.log("== NF-07 서버 응답 시간 (HTML 첫 바이트, 5회 중앙값)");
const cookies = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
for (const path of ["/feed", `/@${slug}`, "/town"]) {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const res = await fetch(BASE + path, { headers: { cookie: cookies } });
    await res.text();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  console.log(`${path.padEnd(16)} ${Math.round(times[2])}ms`);
}

console.log("== NF-07 브라우저에서 화면 완성까지 (데스크톱, 캐시 없음)");
const desk = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await desk.addCookies(await ctx.cookies());
const dp = await desk.newPage();
for (const path of ["/feed", `/@${slug}`]) {
  await dp.goto(BASE + path, { waitUntil: "load" });
  const ms = await dp.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    return Math.round(nav.loadEventEnd - nav.startTime);
  });
  console.log(`${path.padEnd(16)} load ${ms}ms`);
}
await browser.close();
