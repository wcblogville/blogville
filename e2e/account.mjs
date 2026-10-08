// 내 정보: 소셜 연동·해제 (AUTH-05 / FR-036~FR-042, FR-054, SC-011 / quickstart 4.5의 1~11번)
// 사용: 개발 서버를 띄운 상태에서 node e2e/account.mjs <스크린샷 폴더>
// 소셜 키 없이 확인한다. "연동됨" 상태는 DB에 소셜 로그인 수단 행을 직접 넣어 만든다 (실제 연동 흐름은 quickstart 6장 수동 확인).
// DB는 .env.local의 DATABASE_URL로 준비·확인한다. 실행마다 새 아이디를 쓴다.
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();

const n = Date.now() % 100_000_000;
const ID = `ac${n}`;
const PW = "account-pass-1234";
const LABEL = { kakao: "카카오", naver: "네이버", google: "Google" };
const SOCIAL_KEYS = ["KAKAO", "NAVER", "GOOGLE"].filter((k) => process.env[`${k}_CLIENT_ID`] && process.env[`${k}_CLIENT_SECRET`]);
// 화면과 같은 날짜 표기 (src/lib/format.ts formatDate)
const today = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const one = async (q, params) => (await db.query(q, params)).rows[0];
const userId = async () => (await one("SELECT id FROM users WHERE username = $1", [ID])).id;
const rows = async (provider) =>
  (await one("SELECT count(*)::int AS c FROM accounts WHERE user_id = $1 AND provider_id = $2", [await userId(), provider])).c;
const insertSocial = async (provider, accountId = `${provider}-${n}`) =>
  db.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, $3, $4)", [randomUUID(), await userId(), provider, accountId]);

async function fresh(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  return { ctx, page, errors: collectErrors(page) };
}

const row = (page, provider) => page.locator(`li[data-provider="${provider}"]`);
const accountPage = async (page, query = "") => {
  await page.goto(`${BASE}/settings/account${query}`);
  await page.getByRole("heading", { name: "로그인 수단" }).waitFor();
};

/** 화면의 Server Action 요청을 잡는다 (Next-Action 헤더·본문). 그 요청의 인자만 바꿔 "조작한 요청"을 만든다 */
async function captureAction(page, trigger) {
  const reqP = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await trigger();
  const req = await reqP;
  return { id: req.headers()["next-action"], contentType: req.headers()["content-type"], body: req.postData() ?? "" };
}

/** 잡아 둔 Server Action을 다른 인자로 보낸다 (로그인한 페이지의 쿠키로). 결과: { status, redirect } */
const sendAction = (page, action, args) =>
  page.evaluate(
    async ({ id, contentType, body }) => {
      const res = await fetch("/settings/account", {
        method: "POST",
        headers: { "Next-Action": id, Accept: "text/x-component", "Content-Type": contentType },
        body,
      });
      await res.text();
      return { status: res.status, redirect: res.headers.get("x-action-redirect") ?? "" };
    },
    { id: action.id, contentType: action.contentType, body: JSON.stringify(args) },
  );

if (SOCIAL_KEYS.length) results.push(`ℹ️ 소셜 키가 있는 서비스: ${SOCIAL_KEYS.join(", ")} (2번의 [연동하기] 비활성 확인은 키가 없을 때 기준)`);

// ── 1) 로그인하지 않고 /settings/account → / ──
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/settings/account`);
  check("1 비로그인 /settings/account → /", new URL(page.url()).pathname === "/", page.url());
  await ctx.close();
}

const { ctx, page, errors } = await fresh();
await loginDev(page, ID, "남자 주민", PW);

// ── 2) 내 정보: 아이디 로그인 줄(해제 버튼 없음), 카카오·네이버·Google [연동하기] (키가 없어 비활성) ──
{
  await accountPage(page);
  check("2 탭 제목 `내 정보`", (await page.title()).includes("내 정보"), await page.title());
  const cred = row(page, "credential");
  check("2 `아이디 로그인 · {아이디}`", (await cred.innerText()).trim() === `아이디 로그인 · ${ID}`, await cred.innerText());
  check("2 아이디 로그인 줄에 해제 버튼 없음", (await cred.getByRole("button").count()) === 0);
  for (const p of ["kakao", "naver", "google"]) {
    const btn = row(page, p).getByRole("button", { name: `${LABEL[p]} 연동하기` });
    const state = await btn.evaluate((b) => ({ disabled: b.disabled, title: b.title, opacity: getComputedStyle(b).opacity }));
    const expectDisabled = !SOCIAL_KEYS.includes(p.toUpperCase());
    check(
      `2 [${LABEL[p]} 연동하기] ${expectDisabled ? "비활성 + 아직 연결 준비 중이에요" : "활성"}`,
      expectDisabled ? state.disabled && state.title === "아직 연결 준비 중이에요" && Number(state.opacity) < 1 : !state.disabled,
      JSON.stringify(state),
    );
  }
  await page.screenshot({ path: `${outDir}/80-account.png`, fullPage: true });
}

// ── 3) 블로그 관리의 `내 정보` 링크, 헤더 캐릭터 배지 → /settings/account ──
{
  await page.goto(`${BASE}/settings/blog`);
  await page.getByRole("main").getByRole("link", { name: "내 정보", exact: true }).click();
  await page.waitForURL(/\/settings\/account$/, { timeout: 10000 }).catch(() => {});
  check("3 블로그 관리 `내 정보` 링크 → 내 정보", new URL(page.url()).pathname === "/settings/account", page.url());
  await page.goto(`${BASE}/town`);
  await page.getByRole("banner").getByRole("link", { name: "내 정보" }).click();
  await page.waitForURL(/\/settings\/account$/, { timeout: 10000 }).catch(() => {});
  check("3 헤더 캐릭터 배지 → 내 정보", new URL(page.url()).pathname === "/settings/account", page.url());
}

// ── 4) DB에 카카오 연동 행 → `연동됨 ({오늘 날짜})` + [연동 해제] ──
await insertSocial("kakao");
{
  await accountPage(page);
  const kakao = row(page, "kakao");
  check("4 카카오 `연동됨 (오늘)`", await kakao.getByText(`연동됨 (${today})`, { exact: true }).isVisible(), await kakao.innerText());
  check("4 카카오 [연동 해제] 있음, [연동하기] 없음",
    (await kakao.getByRole("button", { name: "연동 해제" }).count()) === 1 && (await kakao.getByRole("button", { name: /연동하기/ }).count()) === 0);
  check("4 네이버는 그대로 [연동하기]", (await row(page, "naver").getByRole("button", { name: "네이버 연동하기" }).count()) === 1);
}

// ── 5) 카카오 연동 시작 Server Action을 조작해 보냄 → 이동할 주소 없음, 연동 행 1개 그대로 ──
// 화면의 [네이버 연동하기]는 키가 없어 비활성이다. 비활성을 풀고 눌러 실제 요청을 잡은 뒤 인자를 kakao로 바꾼다
{
  const before = await one("SELECT count(*)::int AS c FROM accounts WHERE user_id = $1", [await userId()]);
  const naverBtn = row(page, "naver").getByRole("button", { name: "네이버 연동하기" });
  const link = await captureAction(page, async () => {
    await naverBtn.evaluate((b) => b.removeAttribute("disabled"));
    await naverBtn.click({ force: true });
  });
  await page.waitForTimeout(1000);
  check("5 준비: 연동 시작 요청을 잡음", Boolean(link.id) && link.body.includes("naver"), link.body);
  check("5 키 없는 서비스(네이버) 연동 시작 → 이동 없음", new URL(page.url()).pathname === "/settings/account" && !SOCIAL_KEYS.includes("NAVER"), page.url());
  const r = await sendAction(page, link, ["kakao"]);
  check("5 이미 연동한 카카오 연동 시작 → 이동할 주소 없음", r.status === 200 && r.redirect === "", JSON.stringify(r));
  const r2 = await sendAction(page, link, ["credential"]);
  check("5 credential 연동 시작 → 이동할 주소 없음", r2.status === 200 && r2.redirect === "", JSON.stringify(r2));
  const after = await one("SELECT count(*)::int AS c FROM accounts WHERE user_id = $1", [await userId()]);
  check("5 연동 행 수 그대로 (카카오 1개)", before.c === after.c && (await rows("kakao")) === 1, `${before.c} → ${after.c}`);
}

// ── 6) DB에 같은 회원의 카카오 행을 하나 더 → UNIQUE 위반 ──
{
  const err = await insertSocial("kakao", `kakao-other-${n}`).then(() => null, (e) => e);
  check("6 같은 회원 카카오 행 추가 → UNIQUE 거부", err?.code === "23505" && err?.constraint === "accounts_user_provider_uq", err?.constraint ?? "들어감");
}

// ── 9) /settings/account?linked=kakao: 연동 행이 있으면 성공 문구, 없으면 없음 (7번 해제 전후로 확인) ──
{
  await accountPage(page, "?linked=kakao");
  check("9 ?linked=kakao (연동 행 있음) → `카카오 계정을 연동했어요`", await page.getByText("카카오 계정을 연동했어요").isVisible());
  await accountPage(page, "?linked=naver");
  check("9 ?linked=naver (연동 행 없음) → 성공 문구 없음", (await page.getByText("계정을 연동했어요").count()) === 0);
}

// ── 7) [연동 해제] → 확인 창 → 카카오 행 삭제, [카카오 연동하기]로 바뀜 ──
let unlink;
{
  await accountPage(page);
  let dialog = "";
  page.once("dialog", (d) => {
    dialog = d.message();
    d.accept();
  });
  unlink = await captureAction(page, () => row(page, "kakao").getByRole("button", { name: "연동 해제" }).click());
  await row(page, "kakao").getByRole("button", { name: "카카오 연동하기" }).waitFor({ timeout: 10000 }).catch(() => {});
  check("7 확인 창 문구", dialog === "카카오 연동을 해제할까요? 아이디 로그인은 그대로 쓸 수 있어요", dialog);
  check("7 카카오 행 삭제", (await rows("kakao")) === 0);
  check("7 그 줄이 [카카오 연동하기]", (await row(page, "kakao").getByRole("button", { name: "카카오 연동하기" }).count()) === 1);
  check("7 credential 행 그대로", (await rows("credential")) === 1);

  // 확인 창에서 [취소]하면 아무것도 지우지 않는다
  await insertSocial("google");
  await accountPage(page);
  page.once("dialog", (d) => d.dismiss());
  await row(page, "google").getByRole("button", { name: "연동 해제" }).click();
  await page.waitForTimeout(1000);
  check("7 확인 창 [취소] → Google 행 그대로", (await rows("google")) === 1);
}

// ── 8) 해제 Server Action에 credential·목록 밖 값을 넣어 보냄 → credential 행 그대로, 아이디 로그인 됨 ──
{
  for (const arg of ["credential", "CREDENTIAL", "", "github"]) {
    const r = await sendAction(page, unlink, [arg]);
    check(`8 해제 조작 "${arg}" → 오류 없이 무시`, r.status === 200, JSON.stringify(r));
  }
  check("8 credential 행 그대로", (await rows("credential")) === 1);
  check("8 Google 행 그대로 (다른 서비스는 안 지움)", (await rows("google")) === 1);
  const other = await fresh();
  await other.page.goto(BASE);
  await other.page.getByLabel("아이디").fill(ID);
  await other.page.getByLabel("비밀번호", { exact: true }).fill(PW);
  await other.page.getByRole("button", { name: "로그인", exact: true }).click();
  const ok = await other.page.waitForURL(/\/town/, { timeout: 20000 }).then(() => true, () => false);
  check("8 아이디 로그인 됨", ok);
  await other.ctx.close();
}

// ── 9-2) 해제한 뒤 ?linked=kakao → 성공 문구 없음 (주소를 손으로 만든 경우) ──
{
  await accountPage(page, "?linked=kakao");
  check("9 ?linked=kakao (연동 행 없음) → 성공 문구 없음", (await page.getByText("카카오 계정을 연동했어요").count()) === 0);
}

// ── 10) ?provider=kakao&error=<다른 회원 연동 코드> → 문구. 취소 코드는 문구 없음 ──
{
  await accountPage(page, "?provider=kakao&error=account_already_linked_to_different_user");
  check("10 다른 회원 연동 → `이미 다른 Blogville 계정에 연동된 카카오 계정이에요`",
    await page.getByText("이미 다른 Blogville 계정에 연동된 카카오 계정이에요").isVisible());
  await page.screenshot({ path: `${outDir}/81-account-linked-elsewhere.png`, fullPage: true });
  await accountPage(page, "?provider=google&error=access_denied");
  check("10 취소(access_denied) → 문구 없음", (await page.locator('[role="alert"], [role="status"]').filter({ hasText: /연동/ }).count()) === 0);
}

check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
await ctx.close();

// ── 11) 375px: 가로 스크롤 없음, 버튼·링크 누르는 영역 44px 이상, 버튼 글자 한 줄 ──
{
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await loginDev(mp, ID, "남자 주민", PW);
  await accountPage(mp);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("11 375px 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
  const small = await mp.locator("main button, main a, header a[href='/settings/account']").evaluateAll((els) =>
    els
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ t: e.textContent.trim() || e.getAttribute("aria-label"), r: e.getBoundingClientRect(), lh: parseFloat(getComputedStyle(e).lineHeight) }))
      .filter(({ r, lh, t }) => r.height < 44 || r.width < 44 || (t && r.height > 44 && r.height > lh * 2 + 24))
      .map(({ t, r }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  check("11 버튼·링크 44px 이상, 글자 한 줄", small.length === 0, small.join(", "));
  await mp.screenshot({ path: `${outDir}/82-account-375.png`, fullPage: true });
  await m.close();
}

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exitCode = 1;
