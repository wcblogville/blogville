// E2E 공통 도우미
/** 개발 서버 주소. 다른 포트로 띄웠으면 E2E_BASE=http://localhost:3001 처럼 넘긴다 */
export const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

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

/** 헤더 코인. 휴대폰 헤더는 큰 수를 줄여 보여서(`1.2만`) 글자 대신 data-coins 값을 읽는다 */
export async function coins(page) {
  return Number(await page.getByRole("banner").getByTitle("코인").getAttribute("data-coins"));
}

/** 우리 집 방 바닥 칸 (x, y) 가운데의 화면 좌표 (방 카메라 배율 포함) */
export async function roomTileCenter(page, x, y) {
  return page.locator("[data-house-room] [data-room-grid]").evaluate(
    (el, [x, y]) => {
      const r = el.getBoundingClientRect();
      const k = r.width / el.offsetWidth;
      const [ox, oy] = el.dataset.origin.split(",").map(Number);
      const [tw, th] = el.dataset.tileSize.split(",").map(Number);
      return { x: r.left + (ox + ((x - y) * tw) / 2) * k, y: r.top + (oy + ((x + y + 1) * th) / 2) * k };
    },
    [x, y],
  );
}

/**
 * 우리 집 방 바닥 칸을 눌러 주인 캐릭터를 걷게 한다 (2026-10-12부터 혼자 돌아다니지 않고 누르면 걷는다).
 * 기본은 방 왼쪽 앞 모서리 칸 (처음 자리인 방 가운데에서 멀다)
 */
export async function walkInRoom(page, x = null, y = null) {
  const grid = Number(await page.locator("[data-house-room] [data-room-grid]").getAttribute("data-room-grid"));
  const t = await roomTileCenter(page, x ?? 0, y ?? grid - 1);
  await page.mouse.click(t.x, t.y);
}
