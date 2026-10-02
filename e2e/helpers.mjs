// E2E 공통 도우미
export const BASE = "http://localhost:3000";

export function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Playwright 스크린샷이 넣는 caret 스타일 때문에 생기는 하이드레이션 경고는 제외
    if (m.type() === "error" && !m.text().includes("caret-color") && !m.text().includes("401")) errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  return errors;
}

/** 개발용 로그인 후, 처음이면 온보딩까지 마친다 */
export async function loginDev(page, devId, character = "고양이") {
  await page.goto(BASE);
  await page.getByLabel("개발용 아이디").fill(devId);
  await page.getByRole("button", { name: "입장" }).click();
  await page.locator('canvas, input[name="nickname"]').first().waitFor({ timeout: 20000 });
  if (page.url().includes("onboarding")) {
    await page.locator('input[name="nickname"]').fill(devId.slice(0, 12));
    await page.locator('input[name="blogTitle"]').fill(`${devId}의 블로그`);
    await page.locator('input[name="slug"]').fill(devId.toLowerCase());
    await page.locator("label", { hasText: character }).click();
    await page.getByRole("button", { name: /광장으로 출발/ }).click();
    await page.waitForURL(/town/);
  }
}

export async function coins(page) {
  const text = await page.getByRole("banner").getByTitle("코인").innerText();
  return Number(text.replace(/[^0-9]/g, ""));
}
