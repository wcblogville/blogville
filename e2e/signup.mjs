// 회원가입 (AUTH-01, AUTH-07 / FR-001~FR-014, FR-054, SC-001~SC-003, SC-011, SC-013 / quickstart 4.2)
// 사용: 개발 서버를 띄운 상태에서 node e2e/signup.mjs <스크린샷 폴더>
// DB는 .env.local의 DATABASE_URL로 준비·확인한다. 실행마다 새 아이디를 쓴다.
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();

const n = Date.now() % 100_000_000;
const PW = "signup-pass-1234";
const MSG = {
  format: "아이디는 영문 소문자, 숫자, _ 로 4~20자예요",
  short: "비밀번호는 8자 이상이에요",
  long: "비밀번호는 64자까지예요",
  mismatch: "비밀번호가 서로 달라요",
  reserved: "이 아이디는 쓸 수 없어요",
  taken: "이미 있는 아이디예요",
  character: "고를 수 없는 캐릭터예요",
};

const one = async (q, params) => (await db.query(q, params)).rows[0];
const userCount = async () => (await one("SELECT count(*)::int AS c FROM users")).c;
const accountCount = async () => (await one("SELECT count(*)::int AS c FROM accounts")).c;
const userByName = (name) => one("SELECT id, username, role FROM users WHERE username = $1", [name.toLowerCase()]);
const itemId = async (code) => (await one("SELECT id FROM items WHERE code = $1", [code])).id;

async function fresh(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  return { ctx, page, errors: collectErrors(page) };
}

async function openSignup(page) {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "회원가입" }).click();
  await page.getByLabel("비밀번호 확인").waitFor();
}

/**
 * 가입 폼을 채워 보낸다. tamper(form)로 보내기 직전에 화면을 거치지 않은 값(긴 값, 추가 칸, 다른 아이템 번호)을 넣는다.
 * 결과: "town"(광장 도착) 또는 화면의 오류 문구
 */
async function signUp(page, { id, pw = PW, confirm = pw, character, tamper, tamperArg, open = true }) {
  if (open) await openSignup(page);
  // 조작은 채우기 전에 한다 (maxLength가 남아 있으면 fill이 값을 자른다)
  if (tamper) await page.locator("form", { has: page.getByLabel("비밀번호 확인") }).evaluate(tamper, tamperArg);
  await page.getByLabel("아이디").fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill(pw);
  await page.getByLabel("비밀번호 확인").fill(confirm);
  if (character) await page.locator("label", { hasText: character }).click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  return outcome(page);
}

// 폼 안의 오류 한 줄 (Next.js 경로 안내 요소도 role=alert라 폼으로 좁힌다)
const formError = (page) => page.locator('form [role="alert"]');

async function outcome(page) {
  const town = page.waitForURL(/\/town/, { timeout: 20000 }).then(() => "town");
  const alert = formError(page)
    .waitFor({ timeout: 20000 })
    .then(() => formError(page).innerText());
  return Promise.race([town, alert]).catch(() => "(결과 없음)");
}

// 화면을 거치지 않은 값: 입력 칸의 길이 제한을 없앤다
const noLimits = (form) => form.querySelectorAll("input").forEach((i) => i.removeAttribute("maxLength"));

// ── 1) 첫 화면 ──
{
  const { ctx, page } = await fresh();
  await page.goto(BASE);
  check("1 첫 화면은 [로그인] 탭", (await page.getByRole("tab", { name: "로그인" }).getAttribute("aria-selected")) === "true");
  await page.screenshot({ path: `${outDir}/50-signin-tab.png` });
  await page.getByRole("tab", { name: "회원가입" }).click();
  check("1 아이디 칸 아래 안내", await page.getByText("영문 소문자, 숫자, _ 로 4~20자", { exact: true }).isVisible());
  check("1 비밀번호 칸 안내", (await page.getByLabel("비밀번호", { exact: true }).getAttribute("placeholder")) === "비밀번호 (8자 이상)");
  check("1 처음엔 남자 주민이 골라져 있음", await page.getByRole("radio", { name: "남자 주민" }).isChecked());
  // 소셜 키가 없는 환경 기준 (.env.local의 소셜 키를 비워 둔다, quickstart 0장)
  const social = page.getByRole("button", { name: /^(카카오|네이버|Google)$/ });
  const states = await social.evaluateAll((bs) =>
    bs.map((b) => {
      const st = getComputedStyle(b);
      return { label: b.textContent, disabled: b.disabled, title: b.title, opacity: Number(st.opacity), pointer: st.pointerEvents };
    }),
  );
  check(
    "1 소셜 버튼 [카카오][네이버][Google] 3칸 비활성 + 안내",
    states.map((s) => s.label).join() === "카카오,네이버,Google" && states.every((s) => s.disabled && s.title === "아직 연결 준비 중이에요"),
    JSON.stringify(states),
  );
  check("1 비활성 버튼은 흐림", states.every((s) => s.opacity < 1), states.map((s) => s.opacity).join());
  // 마우스를 올리면 안내(title 말풍선)가 보이려면 버튼이 포인터를 받아야 한다
  check("1 비활성 버튼도 마우스를 받음 (안내가 뜸)", states.every((s) => s.pointer !== "none"), states.map((s) => s.pointer).join());
  const hovered = await social.first().hover().then(() => social.first().evaluate((b) => b.matches(":hover")), () => false);
  check("1 비활성 [카카오]에 마우스를 올릴 수 있음", hovered);
  check("1 간편 로그인 준비 중 문구", await page.getByText("간편 로그인은 준비 중이에요").isVisible());
  check("1 회원가입 후 연동 안내", await page.getByText("처음이라면 회원가입 후 내 정보에서 연동해 주세요").isVisible());
  check("1 처음엔 연동 없음 문구 없음", (await page.getByText("연동된 계정이 없어요").count()) === 0);
  await page.screenshot({ path: `${outDir}/51-signup-tab.png` });

  // 키가 없는 서비스로 소셜 로그인 시작을 조작해 보냄 (비활성을 풀고 누름) → 이동하지 않고 안내, bv_remember 쿠키 없음
  await page.getByRole("tab", { name: "로그인" }).click();
  const kakao = page.getByRole("button", { name: "카카오", exact: true });
  await kakao.evaluate((b) => b.removeAttribute("disabled"));
  await kakao.click({ force: true });
  const startError = await page
    .getByRole("alert")
    .filter({ hasText: "아직 연결 준비 중이에요" })
    .waitFor({ timeout: 10000 })
    .then(() => true, () => false);
  check("1 키 없는 서비스 소셜 로그인 시작 → 이동 없음 + `아직 연결 준비 중이에요`", startError && new URL(page.url()).pathname === "/", page.url());
  check("1 키 없는 서비스 → bv_remember 쿠키 없음", !(await ctx.cookies()).some((c) => c.name === "bv_remember"));
  await ctx.close();
}

// ── 1-2) 소셜 로그인에서 돌아온 오류 (FR-033, spec Edge Case) ──
{
  const { ctx, page } = await fresh();
  const NOT_LINKED = "연동된 계정이 없어요. 아이디로 로그인한 뒤 내 정보에서 연동해 주세요";
  const before = await userCount();
  for (const code of ["signup_disabled", "account_not_linked", "email_not_found"]) {
    await page.goto(`${BASE}/?error=${code}`);
    check(`1 /?error=${code} → 연동 없음 문구`, await page.getByText(NOT_LINKED).isVisible());
  }
  await page.goto(`${BASE}/?error=signup_disabled`);
  await page.screenshot({ path: `${outDir}/53-social-not-linked.png` });
  for (const code of ["access_denied", "invalid_code", "x"]) {
    await page.goto(`${BASE}/?error=${code}`);
    check(`1 /?error=${code} (취소 등) → 문구 없음`, (await page.getByText("연동된 계정이 없어요").count()) === 0);
  }
  check("1 소셜 오류 화면을 열어도 회원 수 그대로", (await userCount()) === before);
  await ctx.close();
}

// ── 2) 대문자 섞은 아이디 + 여자 주민으로 가입 → 한 트랜잭션으로 생긴 것 확인 ──
const MAIN = `Su${n}`;
const main = MAIN.toLowerCase();
let mainSession;
{
  const { ctx, page, errors } = await fresh();
  const started = Date.now();
  await openSignup(page);
  // 14) 입력 칸 4개 (아이디, 비밀번호, 비밀번호 확인, 캐릭터)
  const form = page.locator("form", { has: page.getByLabel("비밀번호 확인") });
  const fields = (await form.locator('input:not([type="radio"])').count()) + (await form.locator("fieldset").count());
  check("14 입력 칸 4개", fields === 4, String(fields));
  const r = await signUp(page, { id: MAIN, character: "여자 주민", open: false });
  check("2 가입 후 광장 도착", r === "town", r);
  check("14 시작부터 광장까지 1분 이내", Date.now() - started < 60_000, `${Date.now() - started}ms`);
  const coinsText = await page.getByRole("banner").getByTitle("코인").innerText().catch(() => "");
  check("2 헤더 코인 100", coinsText.replace(/[^0-9]/g, "") === "100", coinsText);
  await page.screenshot({ path: `${outDir}/52-signup-done.png` });

  const u = await one(
    `SELECT u.id, u.username, u.role, u.email, p.nickname, b.slug, b.title, b.description,
            ci.code AS character, bi.code AS background,
            (SELECT array_agg(c.name ORDER BY c.position) FROM categories c WHERE c.blog_id = b.id) AS categories,
            (SELECT array_agg(i.code ORDER BY i.code) FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = u.id) AS owned,
            (SELECT json_agg(json_build_object('reason', l.reason, 'coins', l.coin_delta)) FROM point_ledger l WHERE l.user_id = u.id) AS ledger,
            (SELECT count(*)::int FROM accounts a WHERE a.user_id = u.id AND a.provider_id = 'credential' AND a.password LIKE '%:%') AS credential
     FROM users u JOIN profiles p ON p.user_id = u.id JOIN blogs b ON b.owner_id = u.id
     JOIN items ci ON ci.id = p.character_item_id JOIN items bi ON bi.id = b.background_item_id
     WHERE u.username = $1`,
    [main],
  );
  check("2 아이디는 소문자로 저장", u?.username === main);
  check("2 권한 user", u?.role === "user");
  check("2 닉네임 = 아이디", u?.nickname === main);
  check("2 블로그 이름·주소·소개", u?.title === `${main}의 블로그` && u?.slug === main && u?.description === "");
  check("2 대분류 일상", JSON.stringify(u?.categories) === JSON.stringify(["일상"]));
  check("2 보유 = 여자 주민 + 초원, 둘 다 장착", JSON.stringify(u?.owned) === JSON.stringify(["bg_meadow", "char_girl"]) && u?.character === "char_girl" && u?.background === "bg_meadow");
  check("2 원장 signup 🪙 100 한 건", JSON.stringify(u?.ledger) === JSON.stringify([{ reason: "signup", coins: 100 }]));
  check("2 credential 로그인 수단(해시)", u?.credential === 1);
  const blog = await page.goto(`${BASE}/@${main}`);
  check("2 /@아이디 블로그 열림", blog?.status() === 200);
  check("2 콘솔 오류 없음", errors.length === 0, errors.join(" | "));
  mainSession = ctx;
}

// ── 12) 로그인한 상태로 / → /town ──
{
  const page = await mainSession.newPage();
  await page.goto(BASE);
  check("12 로그인 상태로 / → /town", new URL(page.url()).pathname === "/town");
  await mainSession.close();
}

// ── 3) 다른 브라우저에서 같은 아이디를 전부 대문자로 ──
{
  const { ctx, page } = await fresh();
  const before = await userCount();
  const r = await signUp(page, { id: MAIN.toUpperCase() });
  check("3 대문자 같은 아이디 거부", r === MSG.taken, r);
  check("3 회원 수 그대로", (await userCount()) === before);
  await ctx.close();
}

// ── 4·5·6·7) 형식·비밀번호·입력 유지·예약어 ──
{
  const { ctx, page } = await fresh();
  const before = await userCount();
  for (const id of ["테스터1234", "test-1!", "abc"]) {
    const r = await signUp(page, { id });
    check(`4 아이디 ${JSON.stringify(id)} 거부`, r === MSG.format, r);
  }
  const r21 = await signUp(page, { id: `a${n}`.padEnd(21, "x"), tamper: noLimits });
  check("4 21자 아이디(화면 우회) 거부", r21 === MSG.format, r21);

  const r7 = await signUp(page, { id: `pw${n}`, pw: "1234567" });
  check("5 비밀번호 7자 거부", r7 === MSG.short, r7);
  const r65 = await signUp(page, { id: `pw${n}`, pw: "p".repeat(65), tamper: noLimits });
  check("5 비밀번호 65자(화면 우회) 거부", r65 === MSG.long, r65);
  check("5 65자 비밀번호로 회원이 생기지 않음", !(await userByName(`pw${n}`)));
  await openSignup(page); // 위에서 지운 길이 제한을 되돌린 새 화면
  check("5 화면의 비밀번호 칸은 64자까지", (await page.getByLabel("비밀번호", { exact: true }).getAttribute("maxlength")) === "64");

  // 6) 오류 뒤 입력 유지 + 오류 위치
  const keepId = `Keep${n}`;
  const r6 = await signUp(page, { id: keepId, confirm: "different-pass", character: "여자 주민" });
  check("6 비밀번호 확인 불일치", r6 === MSG.mismatch, r6);
  check("6 아이디 그대로", (await page.getByLabel("아이디").inputValue()) === keepId);
  check("6 고른 캐릭터 그대로", await page.getByRole("radio", { name: "여자 주민" }).isChecked());
  check("6 비밀번호 칸은 비움", (await page.getByLabel("비밀번호", { exact: true }).inputValue()) === "");
  const errBox = await formError(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return { next: el.nextElementSibling?.textContent, bold: Number(s.fontWeight) >= 700, color: s.color, lines: Math.round(el.getBoundingClientRect().height / parseFloat(s.lineHeight)) };
  });
  check("6 오류는 [회원가입] 바로 위 빨간 굵은 글씨 한 줄", errBox.next === "회원가입" && errBox.bold && errBox.lines === 1 && /^rgb\((\d+)/.exec(errBox.color)?.[1] > 150, JSON.stringify(errBox));
  await page.screenshot({ path: `${outDir}/53-signup-error.png` });

  for (const id of ["admin", "settings", "notice", "Admin"]) {
    const r = await signUp(page, { id });
    check(`7 예약어 ${id} 거부`, r === MSG.reserved, r);
  }
  check("4~7 회원 수 그대로", (await userCount()) === before);
  await ctx.close();
}

// ── 9) 두 브라우저에서 같은 새 아이디로 동시에 가입 ──
{
  const id = `cc${n}`;
  const A = await fresh();
  const B = await fresh();
  for (const { page } of [A, B]) {
    await openSignup(page);
    await page.getByLabel("아이디").fill(id);
    await page.getByLabel("비밀번호", { exact: true }).fill(PW);
    await page.getByLabel("비밀번호 확인").fill(PW);
  }
  const [ra, rb] = await Promise.all(
    [A, B].map(async ({ page }) => {
      await page.getByRole("button", { name: "회원가입", exact: true }).click();
      return outcome(page);
    }),
  );
  const count = (await one("SELECT count(*)::int AS c FROM users WHERE username = $1", [id])).c;
  check("9 동시 가입: 회원 1명", count === 1, String(count));
  check("9 동시 가입: 한쪽만 성공, 다른 쪽 이미 있는 아이디", [ra, rb].sort().join(",") === ["town", MSG.taken].sort().join(","), `${ra} / ${rb}`);
  await A.ctx.close();
  await B.ctx.close();
}

// ── 10) 가입 요청 조작: role=admin 칸 / 기본 캐릭터가 아닌 아이템 / 범위 밖 숫자 ──
{
  const { ctx, page } = await fresh();
  const bg = await itemId("bg_meadow");
  const setCharacter = (form, value) => form.querySelectorAll('input[name="characterId"]').forEach((r) => (r.value = value));
  const statuses = [];
  page.on("response", (res) => res.request().method() === "POST" && statuses.push(res.status()));
  const r1 = await signUp(page, { id: `bg${n}`, tamper: setCharacter, tamperArg: String(bg) });
  check("10 기본 캐릭터가 아닌 아이템 거부", r1 === MSG.character, r1);
  const r2 = await signUp(page, { id: `big${n}`, tamper: setCharacter, tamperArg: "99999999999" });
  check("10 범위 밖 아이템 번호 거부", r2 === MSG.character, r2);
  check("10 서버 오류(500) 없음", !statuses.includes(500), statuses.join(","));
  check("10 거부된 아이디로 회원이 생기지 않음", !(await userByName(`bg${n}`)) && !(await userByName(`big${n}`)));
  await ctx.close();

  const adm = await fresh();
  const id = `ro${n}`;
  const r3 = await signUp(adm.page, {
    id,
    tamper: (form) => {
      const extra = document.createElement("input");
      extra.type = "hidden";
      extra.name = "role";
      extra.value = "admin";
      form.appendChild(extra);
    },
  });
  check("10 role=admin 칸을 더해도 가입은 됨", r3 === "town", r3);
  check("10 권한은 user", (await userByName(id))?.role === "user");
  await adm.ctx.close();
}

// (8번은 9·10번이 회원을 더 만든 뒤에 돌린다: 회원 2명이 필요)
// ── 8) 남의 블로그 주소·닉네임과 같은 아이디 ──
{
  const [a, b] = (await db.query("SELECT p.user_id, p.nickname, bl.slug FROM profiles p JOIN blogs bl ON bl.owner_id = p.user_id JOIN users u ON u.id = p.user_id WHERE u.role = 'user' ORDER BY p.created_at DESC LIMIT 2")).rows;
  if (!a || !b) {
    check("8 준비: 회원 2명 필요", false);
  } else {
    await db.query("UPDATE blogs SET slug = $1 WHERE owner_id = $2", [`ck${n}`, a.user_id]);
    await db.query("UPDATE profiles SET nickname = $1 WHERE user_id = $2", [`Nk${n}`, b.user_id]);
    try {
      const { ctx, page } = await fresh();
      const r1 = await signUp(page, { id: `ck${n}` });
      check("8 남의 블로그 주소와 같은 아이디 거부", r1 === MSG.taken, r1);
      const r2 = await signUp(page, { id: `nk${n}` });
      check("8 남의 닉네임(대소문자 무시)과 같은 아이디 거부", r2 === MSG.taken, r2);
      await ctx.close();
    } finally {
      await db.query("UPDATE blogs SET slug = $1 WHERE owner_id = $2", [a.slug, a.user_id]);
      await db.query("UPDATE profiles SET nickname = $1 WHERE user_id = $2", [b.nickname, b.user_id]);
    }
  }
}

// ── 11) 마지막 단계(🪙 100 기록) 실패 → 아무것도 남지 않음 ──
{
  const id = `tx${n}`;
  await db.query(`CREATE OR REPLACE FUNCTION e2e_fail_signup_${n}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.reason = 'signup' AND EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND username = '${id}') THEN
        RAISE EXCEPTION 'e2e: 가입 마지막 단계 실패 시험';
      END IF;
      RETURN NEW;
    END $$`);
  await db.query(`CREATE TRIGGER e2e_fail_signup_${n} BEFORE INSERT ON point_ledger FOR EACH ROW EXECUTE FUNCTION e2e_fail_signup_${n}()`);
  try {
    const { ctx, page } = await fresh();
    await openSignup(page);
    await page.getByLabel("아이디").fill(id);
    await page.getByLabel("비밀번호", { exact: true }).fill(PW);
    await page.getByLabel("비밀번호 확인").fill(PW);
    await page.getByRole("button", { name: "회원가입", exact: true }).click();
    await page.waitForTimeout(3000);
    check("11 실패한 가입은 광장으로 가지 않음", !page.url().includes("/town"));
    const left = await one(
      `SELECT
        (SELECT count(*) FROM users WHERE username = $1)::int AS users,
        (SELECT count(*) FROM users u JOIN accounts a ON a.user_id = u.id WHERE u.username = $1)::int AS accounts,
        (SELECT count(*) FROM profiles WHERE lower(nickname) = $1)::int AS profiles,
        (SELECT count(*) FROM blogs WHERE slug = $1)::int AS blogs,
        (SELECT count(*) FROM categories c JOIN blogs b ON b.id = c.blog_id WHERE b.slug = $1)::int AS categories,
        (SELECT count(*) FROM accounts WHERE account_id IN (SELECT id FROM users WHERE username = $1))::int AS credential`,
      [id],
    );
    // 회원 ID를 알 수 없으므로(롤백) 보유 아이템·원장은 "주인 없는 행이 없음"으로 확인한다
    const orphans = await one(
      `SELECT (SELECT count(*) FROM user_items ui WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ui.user_id))::int AS items,
              (SELECT count(*) FROM point_ledger l WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = l.user_id))::int AS ledger`,
    );
    check("11 회원·로그인 수단·프로필·블로그·카테고리·아이템·원장 모두 0행", Object.values({ ...left, ...orphans }).every((v) => v === 0), JSON.stringify({ ...left, ...orphans }));
    await ctx.close();
  } finally {
    await db.query(`DROP TRIGGER IF EXISTS e2e_fail_signup_${n} ON point_ledger`);
    await db.query(`DROP FUNCTION IF EXISTS e2e_fail_signup_${n}()`);
  }
}

// ── 13) 키보드(Tab·Space·Enter)만으로 가입 ──
{
  const { ctx, page } = await fresh();
  const id = `kb${n}`;
  await page.goto(BASE);
  await page.waitForLoadState("networkidle"); // 화면이 하이드레이션된 뒤에 키를 누른다
  const focused = () => page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), label: document.activeElement?.getAttribute("aria-label"), visible: document.activeElement?.matches(":focus-visible") ?? false }));
  const tabUntil = async (pred, max = 40) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab");
      const f = await focused();
      if (pred(f)) return f;
    }
    return null;
  };
  const tabFocus = await tabUntil((f) => f.text === "회원가입");
  const ringSeen = [];
  if (tabFocus) {
    ringSeen.push(tabFocus.visible);
    await page.keyboard.press("Enter");
    await page.getByLabel("비밀번호 확인").waitFor();
    const idField = await tabUntil((f) => f.label === "아이디");
    if (idField) ringSeen.push(idField.visible);
    await page.keyboard.type(id);
    await page.keyboard.press("Tab");
    await page.keyboard.type(PW);
    await page.keyboard.press("Tab");
    await page.keyboard.type(PW);
    await page.keyboard.press("Tab"); // 캐릭터 고르기 (골라진 남자 주민)
    const radioRing = await page.evaluate(() => {
      const el = document.activeElement;
      const box = el?.nextElementSibling;
      return el?.getAttribute("type") === "radio" && !!box && getComputedStyle(box).boxShadow !== "none";
    });
    ringSeen.push(radioRing);
    await page.keyboard.press("Space");
    const submit = await tabUntil((f) => f.text === "회원가입" && f.label === null, 5);
    if (submit) ringSeen.push(submit.visible);
    await page.screenshot({ path: `${outDir}/54-signup-keyboard.png` });
    await page.keyboard.press("Enter");
  }
  const r = await page.waitForURL(/\/town/, { timeout: 20000 }).then(() => "town").catch(() => page.url());
  check("13 키보드만으로 가입", r === "town", r);
  check("13 이동하는 동안 초점 테두리가 보임", ringSeen.length === 4 && ringSeen.every(Boolean), JSON.stringify(ringSeen));
  await ctx.close();
}

// ── 15) 라이브러리 HTTP 직접 POST → 404, 데이터 변화 없음 ──
{
  const ctx = await browser.newContext();
  const before = [await userCount(), await accountCount()];
  const id = `lib${n}`;
  const bodies = {
    "/api/auth/sign-up/email": { email: `${id}@example.com`, password: PW, name: id, username: id },
    "/api/auth/sign-in/username": { username: id, password: PW },
    "/api/auth/update-user": { name: "hacked" },
    "/api/auth/sign-in/social": { provider: "kakao", callbackURL: "/town" },
    "/api/auth/link-social": { provider: "google" },
    "/api/auth/unlink-account": { providerId: "credential" },
  };
  for (const [path, data] of Object.entries(bodies)) {
    const res = await ctx.request.post(`${BASE}${path}`, { data, headers: { origin: BASE } });
    check(`15 POST ${path} → 404`, res.status() === 404, String(res.status()));
  }
  const after = [await userCount(), await accountCount()];
  check("15 회원·로그인 수단 수 변화 없음", JSON.stringify(before) === JSON.stringify(after), `${before} → ${after}`);
  await ctx.close();
}

// ── 16) 375px 첫 화면 ──
{
  const { ctx, page } = await fresh({ width: 375, height: 812 });
  const measure = () =>
    page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      const targets = [...document.querySelectorAll('[role="tab"], form button, button[title]')].map((el) => {
        const r = el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        const tops = new Set([...range.getClientRects()].map((x) => Math.round(x.top)));
        return { text: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), lines: tops.size };
      });
      return { overflow, targets };
    });
  await page.goto(BASE);
  const signin = await measure();
  await page.screenshot({ path: `${outDir}/55-signin-375.png`, fullPage: true });
  await page.getByRole("tab", { name: "회원가입" }).click();
  const signup = await measure();
  await page.screenshot({ path: `${outDir}/56-signup-375.png`, fullPage: true });
  for (const [name, m] of [["로그인 탭", signin], ["회원가입 탭", signup]]) {
    check(`16 375px ${name} 가로 스크롤 없음`, !m.overflow);
    const small = m.targets.filter((t) => t.w < 44 || t.h < 44);
    check(`16 375px ${name} 누르는 영역 44px 이상`, small.length === 0, JSON.stringify(small));
    const wrapped = m.targets.filter((t) => t.lines > 1);
    check(`16 375px ${name} 버튼 글자 한 줄`, wrapped.length === 0, JSON.stringify(wrapped));
  }
  await ctx.close();
}

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
