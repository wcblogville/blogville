// 회원가입·로그인·관리자 권한 (AUTH-01, AUTH-02, AUTH-08 / quickstart 4.1)
// 사용: 개발 서버를 띄운 상태에서 node e2e/auth.mjs <스크린샷 폴더>. DB는 .env.local의 DATABASE_URL로 준비·확인한다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

// 관리자 비밀번호는 코드에 쓰지 않고 .env.local에서 읽는다
config({ path: ".env.local", quiet: true });
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, params) => (await db.query(q, params)).rows[0];

const outDir = process.argv[2] ?? "e2e-shots";
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  return { ctx, page, errors: collectErrors(page) };
}

// 실행마다 새 아이디 (DB를 비우지 않고 여러 번 돌려도 같은 결과)
const NEWBIE = `au${Date.now() % 100_000_000}`;
const NEWBIE_PW = "newbie-pass-1";

async function signUp(page, id, pw, confirm = pw) {
  await page.goto(BASE);
  await page.getByRole("tab", { name: "회원가입" }).click();
  await page.getByLabel("아이디").fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill(pw);
  await page.getByLabel("비밀번호 확인").fill(confirm);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
}

async function signIn(page, id, pw) {
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}

// 1) 새 회원가입 → 온보딩 없이 바로 내 블로그(집 안), 환영 문구 → 🚪 문으로 마을에 처음 나감 (마을 개편 2차)
{
  const { ctx, page, errors } = await fresh();
  await page.goto(BASE);
  await page.getByRole("tab", { name: "회원가입" }).click();
  await page.screenshot({ path: `${outDir}/40-signup.png` });
  await signUp(page, NEWBIE, NEWBIE_PW);
  await page.waitForURL(/\/@/, { timeout: 15000 }).catch(() => {});
  check("회원가입 후 바로 내 블로그(/@아이디)로 이동", new URL(page.url()).pathname === `/@${NEWBIE}`, page.url());
  check(
    "블로그에 환영 문구",
    await page
      .getByText(/님, Blogville에 오신 걸 환영해요!/)
      .filter({ visible: true }) // 휴대폰용 메뉴의 같은 문구는 숨어 있다
      .first()
      .waitFor({ timeout: 10000 })
      .then(() => true)
      .catch(() => false),
  );
  check("환영 문구에 닉네임(= 아이디)", (await page.getByText(`${NEWBIE}님, Blogville에 오신 걸 환영해요!`).count()) > 0);
  await page.screenshot({ path: `${outDir}/40-signup-blog.png` });
  await page.locator("[data-house-door]").click();
  await page.waitForURL(/\/town\?welcome=1/, { timeout: 15000 }).catch(() => {});
  check("🚪 문 → 마을, `마을에 처음 나왔어요`", await page.getByText(/님, 마을에 처음 나왔어요!/).filter({ visible: true }).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await page.screenshot({ path: `${outDir}/40-signup-town.png` });
  check("콘솔 오류 없음", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
  await ctx.close();
}

// 2) 같은 아이디로 다시 가입 → 오류, 비밀번호 확인 불일치 → 오류
{
  const { ctx, page } = await fresh();
  await signUp(page, NEWBIE, "another-pass-1");
  check("중복 아이디 거부", await page.getByText("이미 있는 아이디예요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await signUp(page, `${NEWBIE}x`, "pass-word-1", "pass-word-2");
  check("비밀번호 확인 불일치 거부", await page.getByText("비밀번호가 서로 달라요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await ctx.close();
}

// 3) 틀린 비밀번호 → 오류, 맞으면 로그인 → 광장, 헤더에 레벨·코인·캐릭터
{
  const { ctx, page } = await fresh();
  await signIn(page, NEWBIE, "wrong-password");
  check("틀린 비밀번호 거부", await page.getByText("아이디 또는 비밀번호가 맞지 않아요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await signIn(page, NEWBIE, NEWBIE_PW);
  await page.waitForURL(/\/town/, { timeout: 15000 }).catch(() => {});
  check("맞는 비밀번호로 로그인 → 광장", new URL(page.url()).pathname === "/town");
  // 마을에는 헤더 막대가 없어서(사용자 요청 2026-10-08) 다른 화면의 헤더로 확인한다
  await page.goto(`${BASE}/feed`);
  const banner = page.getByRole("banner");
  check(
    "헤더에 레벨·코인 110 (가입 100 + 1일차 자동 출석 10)",
    (await banner.getByTitle("레벨").isVisible()) && (await banner.getByTitle("코인").innerText()).includes("110"),
  );
  await ctx.close();
}

// 3-2) 소셜 로그인 실패 문구 (NF-19, 2026-10-13, 문구 표 src/lib/social-errors.ts).
// 실제 소셜 서비스를 부르지 않고, 라이브러리가 돌려보내는 주소(?error=코드)를 그대로 열어 본다
{
  const { ctx, page, errors } = await fresh();
  const notice = (text) => page.locator("[data-social-error]").filter({ hasText: text });
  await page.goto(`${BASE}/?error=state_mismatch`);
  check("소셜 /?error=state_mismatch → `로그인 시간이 지났어요. 다시 시도해 주세요` (alert)",
    (await notice("로그인 시간이 지났어요. 다시 시도해 주세요").getAttribute("role")) === "alert");
  await page.screenshot({ path: `${outDir}/43-social-state-mismatch.png` });
  await page.goto(`${BASE}/?provider=kakao&error=unable_to_get_user_info`);
  check("소셜 카카오 unable_to_get_user_info → `카카오에서 정보를 못 받았어요`",
    await notice("카카오에서 정보를 못 받았어요. 잠시 뒤 다시 시도해 주세요").isVisible());
  await page.goto(`${BASE}/?provider=naver&error=access_denied`);
  check("소셜 취소(access_denied) → 부드러운 `로그인을 취소했어요` (status)",
    (await notice("로그인을 취소했어요").getAttribute("role")) === "status");
  await page.goto(`${BASE}/?error=%3Cb%3Ehi%3C%2Fb%3E`);
  check("소셜 모르는 코드 → 일반 문구, 주소 글자는 화면에 없음",
    (await notice("로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요").isVisible()) && (await page.getByText("hi", { exact: true }).count()) === 0);
  // 로그인한 회원이 오류 코드를 들고 첫 화면에 오면(연동 중 state 오류) → 회원정보 수정에서 문구
  await signIn(page, NEWBIE, NEWBIE_PW);
  await page.waitForURL(/\/town/, { timeout: 15000 }).catch(() => {});
  await page.goto(`${BASE}/?provider=kakao&error=state_mismatch`);
  await page.waitForURL(/\/settings\/account/, { timeout: 15000 }).catch(() => {});
  check("로그인한 회원 /?error=state_mismatch → 회원정보 수정 + `연동 시간이 지났어요`",
    new URL(page.url()).pathname === "/settings/account" && (await notice("연동 시간이 지났어요. 다시 시도해 주세요").isVisible()));
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/town/, { timeout: 15000 }).catch(() => {});
  check("로그인한 회원 오류 코드 없이 / → 광장 그대로", new URL(page.url()).pathname === "/town");
  check("소셜 실패 문구 화면 콘솔 오류 없음", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
  await ctx.close();
}

// ── 관리자 (US5 / quickstart 4.1 5~9번) ──
// 준비: 일반 회원 normal01과 그 회원의 글, 관리자 공지 블로그의 글을 DB로 만든다 (실행마다 새 제목)
const n = Date.now() % 100_000_000;
const MEMBER_POST = `지울 글 ${n}`;
const ADMIN_POST = `관리자 글 ${n}`;
const insertPost = async (slug, title) =>
  (
    await one(
      `INSERT INTO posts (blog_id, title, content_html, content_text)
       SELECT id, $2, '<p>e2e</p>', 'e2e' FROM blogs WHERE slug = $1 RETURNING id`,
      [slug, title],
    )
  )?.id;
const postExists = async (id) => Boolean(await one("SELECT 1 FROM posts WHERE id = $1", [id]));
{
  const { ctx, page } = await fresh();
  await loginDev(page, "normal01");
  await ctx.close();
}
const memberPostId = await insertPost("normal01", MEMBER_POST);
const adminPostId = await insertPost("notice", ADMIN_POST);
check("준비: 일반 회원 글·관리자 글", Boolean(memberPostId && adminPostId));

// 5) 로그인하지 않고 /admin → 404, 관리자 화면 글자 없음
{
  const { ctx, page } = await fresh();
  const res = await page.goto(`${BASE}/admin`);
  check("5 비로그인 /admin → 404", res?.status() === 404);
  check("5 비로그인 /admin에 `최근 가입` 없음", (await page.getByText("최근 가입").count()) === 0);
  await ctx.close();
}

// 7) 관리자 로그인 → [👑 관리자] → 통계 카드 5개·최근 가입·최근 글
// 8) 관리자가 남의 글 [삭제] → 확인 창 → 삭제. 이때 보낸 Server Action 요청(ID·형식)을 6번 조작에 쓴다
let deleteAction = null;
{
  const { ctx, page, errors } = await fresh();
  await signIn(page, ADMIN.username, ADMIN.password);
  await page.waitForURL(/town/, { timeout: 15000 }).catch(() => {});
  check("7 관리자 로그인 → 광장", page.url().includes("/town"));
  // 마을에는 헤더 막대가 없어서 ☰ 메뉴 아래에 있다 (사용자 요청 2026-10-08)
  await page.getByRole("button", { name: /메뉴/ }).click();
  check("7 ☰ 메뉴에 [👑 관리자]", await page.getByRole("link", { name: "관리자" }).isVisible());
  await page.getByRole("link", { name: "관리자" }).click();
  await page.waitForURL(/admin/);
  await page.getByText("최근 가입").waitFor();
  await page.screenshot({ path: `${outDir}/41-admin.png`, fullPage: true });

  const cardLabels = await page.locator("[data-stat-card] p:first-child").allInnerTexts();
  check("7 통계 카드 5개", JSON.stringify(cardLabels) === JSON.stringify(["가입 계정", "전체 글", "댓글", "오늘 새 글", "오늘 출석"]), cardLabels.join(","));
  check("7 `주민 (온보딩 완료)` 없음", (await page.getByText("주민 (온보딩 완료)").count()) === 0);
  check("7 `온보딩 전` 없음", (await page.getByText("온보딩 전").count()) === 0);
  const userRows = await page.locator("section", { hasText: "최근 가입" }).locator("tbody tr").count();
  check("7 최근 가입 20명 이하", userRows > 0 && userRows <= 20, `${userRows}명`);
  check("7 최근 가입에 로그인 방식 `아이디`", (await page.getByText(`${NEWBIE} (아이디)`).count()) > 0);
  check("7 최근 글에 남의 글", await page.getByRole("link", { name: MEMBER_POST }).isVisible());

  // 8)
  let dialogMessage = "";
  page.once("dialog", (d) => {
    dialogMessage = d.message();
    d.accept();
  });
  const requestP = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await page.getByRole("row", { name: new RegExp(MEMBER_POST) }).getByRole("button", { name: "삭제" }).click();
  const req = await requestP;
  deleteAction = { actionId: req.headers()["next-action"], contentType: req.headers()["content-type"] };
  await page.getByRole("link", { name: MEMBER_POST }).waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  check("8 확인 창 문구", dialogMessage === `'${MEMBER_POST}' 글을 삭제할까요?`, dialogMessage);
  check("8 남의 글 삭제됨 (DB)", !(await postExists(memberPostId)));
  check("8 화면 목록에서도 사라짐", (await page.getByRole("link", { name: MEMBER_POST }).count()) === 0);
  check("7·8 관리자 콘솔 오류 없음", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
  await ctx.close();
}

// 6) 일반 회원: /admin 404, [👑 관리자] 없음, 관리자 글 삭제 Server Action을 조작해 보내도 글 그대로
{
  const { ctx, page } = await fresh();
  await loginDev(page, "normal01");
  check("6 일반 회원 헤더에 [👑 관리자] 없음", (await page.getByRole("link", { name: "관리자" }).count()) === 0);
  const res = await page.goto(`${BASE}/admin`);
  check("6 일반 회원 /admin → 404", res?.status() === 404 && (await page.getByText("최근 가입").count()) === 0);
  if (deleteAction) {
    const status = await page.evaluate(
      async ({ actionId, contentType, body }) =>
        (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType }, body })).status,
      { ...deleteAction, body: JSON.stringify([adminPostId]) },
    );
    check("6 조작한 관리자 글 삭제: 성공 아님", status >= 400, `HTTP ${status}`);
    check("6 조작한 관리자 글 삭제: 글 그대로", await postExists(adminPostId));
  } else {
    check("6 조작 요청 준비(8번의 Server Action)", false);
  }
  await ctx.close();
}

// 9) 관리자 화면 375px: 가로 스크롤 없음, [삭제]·링크 누르는 영역 44px 이상, 버튼 글자 한 줄
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await signIn(page, ADMIN.username, ADMIN.password);
  await page.waitForURL(/town/, { timeout: 15000 }).catch(() => {});
  await page.goto(`${BASE}/admin`);
  await page.getByText("최근 가입").waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("9 375px 가로 스크롤 없음", overflow <= 0, `넘침 ${overflow}px`);
  const boxes = async (locator) => {
    const out = [];
    for (const el of await locator.all()) if (await el.isVisible()) out.push(await el.boundingBox());
    return out;
  };
  const del = await boxes(page.locator("main").getByRole("button", { name: "삭제" }));
  check("9 [삭제] 44×44px 이상", del.length > 0 && del.every((b) => b.width >= 44 && b.height >= 44), `${del.length}개`);
  const oneLine = await page
    .locator("main")
    .getByRole("button", { name: "삭제" })
    .first()
    .evaluate((b) => {
      const range = document.createRange();
      range.selectNodeContents(b);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size === 1;
    });
  check("9 [삭제] 글자 한 줄", oneLine);
  const links = await boxes(page.locator("main section").getByRole("link"));
  check("9 제목·블로그 링크 높이 44px 이상", links.length > 0 && links.every((b) => b.height >= 44), `${links.length}개`);
  await page.screenshot({ path: `${outDir}/42-admin-375.png`, fullPage: true });
  await ctx.close();
}

await db.query("DELETE FROM posts WHERE id = $1", [adminPostId]); // 준비한 관리자 글 정리

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exitCode = 1;
