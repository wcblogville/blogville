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

/**
 * 아이디로 로그인하고, 없는 계정이면 회원가입한다 (AUTH-01: 가입 폼에서 캐릭터를 고르고 바로 광장).
 * 가입한 회원의 닉네임·블로그 주소는 아이디(소문자)와 같다.
 */
export async function loginDev(page, devId, character = "남자 주민", password = "test-password-1234") {
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(devId);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  // 로그인 성공(광장 / 휴대폰 메뉴) 또는 실패 메시지 중 먼저 나오는 것
  await page
    .locator("canvas, [data-town-menu]:visible")
    .or(page.getByText("아이디 또는 비밀번호가"))
    .first()
    .waitFor({ timeout: 20000 });

  if (await page.getByText("아이디 또는 비밀번호가").isVisible()) {
    await page.getByRole("tab", { name: "회원가입" }).click();
    await page.getByLabel("아이디").fill(devId);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인").fill(password);
    await page.locator("label", { hasText: character }).click();
    await page.getByRole("button", { name: "회원가입", exact: true }).click();
    await page.waitForURL(/\/town/, { timeout: 20000 });
  }
}

export async function coins(page) {
  const text = await page.getByRole("banner").getByTitle("코인").innerText();
  return Number(text.replace(/[^0-9]/g, ""));
}
