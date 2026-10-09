// E2E 공통 도우미
export const BASE = "http://localhost:3000";

/**
 * 화면 오류를 모은다. 레벨업 팝업(GAME-06)은 보상으로 언제든 뜰 수 있어서, 기본으로 뜨면 [확인]을 눌러 닫는다.
 * 팝업 자체를 확인하는 시험(e2e/notifications.mjs)은 { keepLevelUp: true }로 끈다.
 */
export function collectErrors(page, { keepLevelUp = false } = {}) {
  if (!keepLevelUp) {
    const dialog = page.locator('dialog[open][aria-labelledby="level-up-title"]');
    page.addLocatorHandler(dialog, async () => {
      await dialog.getByRole("button", { name: "확인" }).click();
      await dialog.waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
    });
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Playwright 스크린샷이 넣는 caret 스타일 때문에 생기는 하이드레이션 경고는 제외
    if (m.type() === "error" && !m.text().includes("caret-color") && !m.text().includes("401")) errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  return errors;
}

/**
 * 아이디로 로그인하고, 없는 계정이면 회원가입한다 (AUTH-01: 가입 폼에서 캐릭터를 고르면 내 블로그, 그다음 광장으로 옮긴다).
 * 가입한 회원의 닉네임·블로그 주소는 아이디(소문자)와 같다.
 */
export async function loginDev(page, devId, character = "남자 주민", password = "test-password-1234") {
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(devId);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  // 로그인 성공(광장 / 휴대폰은 아래 탭) 또는 실패 메시지 중 먼저 나오는 것
  await page
    .locator("canvas, [data-town-menu]:visible, [data-mobile-tabs]:visible")
    .or(page.getByText("아이디 또는 비밀번호가"))
    .first()
    .waitFor({ timeout: 20000 });
  // 휴대폰 회원은 광장 대신 내 블로그로 옮겨진다 (src/components/town/phone-home.tsx). 옮겨진 뒤에 이어 간다
  if (await page.locator("[data-mobile-tabs]:visible").count()) await page.waitForURL(/\/@/, { timeout: 15000 }).catch(() => {});

  if (await page.getByText("아이디 또는 비밀번호가").isVisible()) {
    await page.getByRole("tab", { name: "회원가입" }).click();
    await page.getByLabel("아이디").fill(devId);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인").fill(password);
    await page.locator("label", { hasText: character }).click();
    await page.getByRole("button", { name: "회원가입", exact: true }).click();
    // 첫 가입은 내 블로그(집 안)에서 시작한다 (마을 개편 2차). 시험은 광장(휴대폰은 내 블로그)에서 이어 간다
    await page.waitForURL(/\/@[a-z0-9_]+\?welcome=1/, { timeout: 20000 });
    await page.goto(`${BASE}/town`);
    if (await page.locator("[data-mobile-tabs]:visible").count()) await page.waitForURL(/\/@/, { timeout: 15000 }).catch(() => {});
  }
}

export async function coins(page) {
  const text = await page.getByRole("banner").getByTitle("코인").innerText();
  return Number(text.replace(/[^0-9]/g, ""));
}
