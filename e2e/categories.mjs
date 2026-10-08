// 카테고리 2단계 — 대분류·소분류 관리와 블로그 홈 트리 (BLOG-05 / US5-1~10, FR-005·039, SC-007·008·009, quickstart 3.3)
// 사용: 개발 서버를 띄운 상태에서 node e2e/categories.mjs <스크린샷 폴더>
// 실행마다 새 회원을 만든다. post 단계 3(posts.subcategory_id) 전이면 소분류 글 수·거르기·글 소속 줄은 "⏭ 건너뜀"으로 표시한다.
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, args) => (await db.query(q, args)).rows[0];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const skip = (name, why) => results.push(`⏭ ${name} — 건너뜀: ${why}`);
const browser = await chromium.launch();
const allErrors = [];
const HUGE = 99999999999;

const n = Date.now() % 100_000_000;
const OWNER = `ct${n}`;
const OTHER = `cu${n}`;
const hasSubcolumn = Boolean(
  await one("SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'subcategory_id'"),
);
const POST3 = "post 단계 3 전 (posts.subcategory_id 없음)";

async function fresh(storageState) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState });
  const page = await ctx.newPage();
  allErrors.push(collectErrors(page));
  page.on("dialog", (d) => d.accept());
  return { ctx, page };
}
const own = await fresh();
await loginDev(own.page, OWNER);
const oth = await fresh();
await loginDev(oth.page, OTHER, "여자 주민");
const owner = await one("SELECT u.id, b.id AS blog_id FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = $1", [OWNER]);
const other = await one("SELECT u.id, b.id AS blog_id FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = $1", [OTHER]);
const page = own.page;

// 화면 도우미: Server Action 응답과 다시 그리기를 기다린다
const settled = async () => {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
};
/** 누르고 그 Server Action 응답까지 기다린다 */
async function act(doIt) {
  const res = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
  await doIt();
  await res;
  await settled();
}
const catRow = (name) => page.locator("main li", { has: page.getByRole("button", { name: `${name} 위로`, exact: true }) }).first();
const catNames = async () =>
  (await db.query("SELECT name, position FROM categories WHERE blog_id = $1 ORDER BY position, id", [owner.blog_id])).rows;
const subNames = async (catName) =>
  (
    await db.query(
      "SELECT s.name, s.position FROM subcategories s JOIN categories c ON c.id = s.category_id WHERE c.blog_id = $1 AND c.name = $2 ORDER BY s.position, s.id",
      [owner.blog_id, catName],
    )
  ).rows;
const contiguous = (rows) => rows.every((r, i) => r.position === i);
const addCat = page.getByLabel("새 카테고리 이름");
async function addCategory(name, how = "button") {
  await addCat.evaluate((i) => i.removeAttribute("maxLength"));
  await addCat.fill(name);
  await act(() => (how === "enter" ? addCat.press("Enter") : page.getByRole("button", { name: "추가", exact: true }).last().click()));
}
async function addSub(catName, name) {
  const row = catRow(catName);
  if (!(await row.getByLabel("새 소분류 이름").count())) await row.getByRole("button", { name: "소분류 추가" }).click();
  const input = row.getByLabel("새 소분류 이름");
  await input.evaluate((i) => i.removeAttribute("maxLength"));
  await input.fill(name);
  await act(() => row.getByRole("button", { name: "추가", exact: true }).click());
}
const alertUnder = (loc) => loc.locator('[role="alert"]').first().innerText().catch(() => "");

await page.goto(`${BASE}/settings/blog`);

// US5-1·2 대분류 추가(버튼·Enter) 맨 아래·칸 비움, 소분류 그 아래 맨 끝, 누름 4번 이하
{
  let clicks = 0;
  await addCat.fill("여행");
  await page.getByRole("button", { name: "추가", exact: true }).last().click();
  clicks++;
  await page.getByRole("button", { name: "여행 위로", exact: true }).waitFor();
  await catRow("여행").getByRole("button", { name: "소분류 추가" }).click();
  clicks++;
  await catRow("여행").getByLabel("새 소분류 이름").fill("맛집");
  await catRow("여행").getByRole("button", { name: "추가", exact: true }).click();
  clicks++;
  await page.getByRole("button", { name: "맛집 위로", exact: true }).waitFor();
  check("US5-1·2 대분류 + 소분류를 누름 4번 이하로", clicks <= 4, `${clicks}번`);
  check("US5-1 추가 칸 비움", (await addCat.inputValue()) === "");
  await addCategory("공부", "enter");
  await page.getByRole("button", { name: "공부 위로", exact: true }).waitFor();
  const cats = await catNames();
  check("US5-1 Enter로도 추가, 맨 아래·0부터 빈틈 없음", JSON.stringify(cats.map((c) => c.name)) === JSON.stringify(["일상", "여행", "공부"]) && contiguous(cats), JSON.stringify(cats));
  await addSub("여행", "카페");
  const subs = await subNames("여행");
  check("US5-2 소분류는 그 대분류 아래 맨 끝", JSON.stringify(subs.map((s) => s.name)) === JSON.stringify(["맛집", "카페"]) && contiguous(subs), JSON.stringify(subs));
}

// US5-3 같은 이름 → `이미 있는 카테고리예요`, 추가 칸 값 남음 / 이름 바꾸기도
{
  await addCategory("여행");
  const msg = await alertUnder(page.locator("main section", { has: addCat }).locator("> div > div").last());
  check("US5-3 같은 이름 대분류 추가 → `이미 있는 카테고리예요`", msg === "이미 있는 카테고리예요", msg);
  check("US5-3 오류 때 추가 칸에 입력값 남음", (await addCat.inputValue()) === "여행", await addCat.inputValue());
  await catRow("공부").getByRole("button", { name: "이름 바꾸기" }).first().click();
  const edit = page.getByLabel("카테고리 이름", { exact: true });
  await edit.fill("여행");
  await page.locator("main li", { has: edit }).getByRole("button", { name: "저장" }).click();
  const row = page.locator("main li", { has: edit });
  await row.locator('[role="alert"]').waitFor();
  check("US5-3 이름 바꾸기도 같은 이름 → `이미 있는 카테고리예요`, 고친 이름 남음", (await alertUnder(row)) === "이미 있는 카테고리예요" && (await edit.inputValue()) === "여행");
  await row.getByRole("button", { name: "취소" }).click();
}

// US5-4 "여행" 아래 "맛집" 또 → 거부, "공부" 아래 "맛집" → 성공
{
  await addSub("여행", "맛집");
  const msg = await alertUnder(catRow("여행").locator("ul"));
  check("US5-4 같은 대분류에 같은 소분류 → 거부", msg === "이미 있는 카테고리예요" && (await subNames("여행")).length === 2, msg);
  await addSub("공부", "맛집");
  check("US5-4 다른 대분류엔 같은 이름 소분류 성공", (await subNames("공부")).map((s) => s.name).join() === "맛집");
}

// US5-5 공백만 / 21자 → 문구, 앞뒤 공백 제거
{
  await addCategory("   ");
  const sec = page.locator("main section", { has: addCat });
  check("US5-5 공백만 → `카테고리 이름을 적어 주세요`", (await alertUnder(sec.locator("> div > div").last())) === "카테고리 이름을 적어 주세요");
  await addCategory("가".repeat(21));
  check("US5-5 21자 → `카테고리 이름은 20자까지예요`", (await alertUnder(sec.locator("> div > div").last())) === "카테고리 이름은 20자까지예요");
  await addCategory("  산책  ");
  await page.getByRole("button", { name: "산책 위로", exact: true }).waitFor();
  check("US5-5 `  산책  ` → `산책`", (await catNames()).some((c) => c.name === "산책"));
  await addSub("여행", "   ");
  check("US5-5 소분류 공백만 → `카테고리 이름을 적어 주세요`", (await alertUnder(catRow("여행").locator("ul"))) === "카테고리 이름을 적어 주세요");
  await addSub("여행", "나".repeat(21));
  check("US5-5 소분류 21자 → `카테고리 이름은 20자까지예요`", (await alertUnder(catRow("여행").locator("ul"))) === "카테고리 이름은 20자까지예요");
}

// US5-6 ▲▼: 맨 위 ▲·맨 아래 ▼ 비활성, 소분류는 같은 대분류 안에서만, 0부터 빈틈 없음, 블로그 홈 순서와 같음
{
  await page.goto(`${BASE}/settings/blog`);
  const up = (name) => page.getByRole("button", { name: `${name} 위로`, exact: true });
  const down = (name) => page.getByRole("button", { name: `${name} 아래로`, exact: true });
  check("US5-6 맨 위 ▲·맨 아래 ▼ 비활성", (await up("일상").isDisabled()) && (await down("산책").isDisabled()) && !(await up("여행").isDisabled()));
  check("US5-6 소분류도 같은 대분류 안에서 맨 위 ▲·맨 아래 ▼ 비활성", (await up("맛집").first().isDisabled()) && (await down("카페").isDisabled()));
  const b = await up("여행").boundingBox();
  const b2 = await down("여행").boundingBox();
  check("US5-6 ▲▼ 가로로 놓이고 각 44×44px 이상", b.width >= 44 && b.height >= 44 && Math.abs(b.y - b2.y) < 2 && b2.x > b.x, `${Math.round(b.width)}×${Math.round(b.height)}`);
  await up("공부").click();
  await settled();
  const cats = await catNames();
  check("US5-6 ▲ → 순서 바뀜·0부터 빈틈 없음", cats.map((c) => c.name).join() === "일상,공부,여행,산책" && contiguous(cats), JSON.stringify(cats));
  await up("카페").click();
  await settled();
  const subs = await subNames("여행");
  check("US5-6 소분류 ▲ → 같은 대분류 안에서만", subs.map((s) => s.name).join() === "카페,맛집" && contiguous(subs) && (await subNames("공부")).length === 1, JSON.stringify(subs));
  // 블로그 홈 왼쪽 트리 순서 = 관리 화면 순서
  await page.goto(`${BASE}/@${OWNER}`);
  const navText = (await page.getByRole("navigation", { name: "카테고리" }).getByRole("link").allInnerTexts()).map((t) => t.replace(/\s*\(\d+\)\s*$/, "").trim());
  check("US5-6 블로그 홈 트리 순서 = 관리 화면 순서", navText.join() === "전체 글,일상,공부,└ 맛집,여행,└ 카페,└ 맛집,산책", navText.join());
  await page.screenshot({ path: `${outDir}/ct-01-home-tree.png`, fullPage: true });
  await page.goto(`${BASE}/settings/blog`);
  await page.screenshot({ path: `${outDir}/ct-02-settings-tree.png`, fullPage: true });
}

// US5-6 두 탭에서 동시에 추가·순서 바꾸기 → 겹침·빈틈 없음 (블로그 행 잠금)
{
  const tabs = await Promise.all([0, 1, 2].map(() => own.ctx.newPage()));
  await Promise.all(tabs.map((t) => t.goto(`${BASE}/settings/blog`)));
  await Promise.all([
    (async () => {
      await tabs[0].getByLabel("새 카테고리 이름").fill("동시1");
      await tabs[0].getByRole("button", { name: "추가", exact: true }).last().click();
    })(),
    (async () => {
      await tabs[1].getByLabel("새 카테고리 이름").fill("동시2");
      await tabs[1].getByRole("button", { name: "추가", exact: true }).last().click();
    })(),
    tabs[2].getByRole("button", { name: "산책 위로", exact: true }).click(),
  ]);
  await Promise.all(tabs.map((t) => t.waitForLoadState("networkidle")));
  await page.waitForTimeout(500);
  const cats = await catNames();
  const positions = cats.map((c) => c.position);
  check("US5-6 동시 추가 2 + 순서 바꾸기 → 0부터 겹침·빈틈 없음", cats.length === 6 && contiguous(cats) && new Set(positions).size === 6, JSON.stringify(cats));
  await Promise.all(tabs.map((t) => t.close()));
}

// US5-7 글 수·거르기: 여행 5개 (대분류만). 소분류 글 수·거르기는 post 단계 3 뒤
const travelId = (await one("SELECT id FROM categories WHERE blog_id = $1 AND name = '여행'", [owner.blog_id])).id;
{
  for (let i = 1; i <= 5; i++)
    await db.query("INSERT INTO posts (blog_id, category_id, title, content_html, content_text, updated_at) VALUES ($1, $2, $3, '<p>x</p>', 'x', '2026-01-01T00:00:00Z')", [owner.blog_id, travelId, `여행 글 ${i}`]);
  await page.goto(`${BASE}/@${OWNER}`);
  const travel = (await page.getByRole("navigation", { name: "카테고리" }).getByRole("link", { name: /^여행/ }).innerText()).replace(/\s+/g, " ");
  check("US5-7 블로그 홈 `여행 (5)`", travel === "여행 (5)", travel);
  await page.getByRole("navigation", { name: "카테고리" }).getByRole("link", { name: /^여행/ }).click();
  await page.waitForURL(/category=/);
  const heading = (await page.locator("main h2").filter({ hasText: "개" }).first().innerText()).replace(/\s+/g, " ");
  check("US5-7 \"여행\" 누르면 5개", heading === "여행 5개" && (await page.locator("main article").count()) === 5, heading);
  const subLink = page.getByRole("navigation", { name: "카테고리" }).getByRole("link", { name: "└ 카페" });
  const subSize = await subLink.boundingBox();
  check("FR-059 소분류 링크 44px 이상·`?sub=` 주소", subSize.height >= 44 && /\?sub=\d+$/.test(await subLink.getAttribute("href")));
  if (hasSubcolumn) skip("US5-7 `└ 맛집 (3)`·\"맛집\" 3개", "post 단계 3 뒤 이 스크립트에 줄을 더한다");
  else skip("US5-7 `└ 맛집 (3)`·\"맛집\" 3개", POST3);
  await subLink.click();
  await page.waitForURL(/sub=/);
  const subSel = await subLink.evaluate((a) => getComputedStyle(a).backgroundColor);
  check("US5-7 소분류를 고르면 그 줄 노란 배경", subSel === "rgb(255, 243, 214)", subSel);
}

// US5-8 소분류 삭제 확인 창 문구, 글은 대분류에 남음
{
  await page.goto(`${BASE}/settings/blog`);
  let dialogText = "";
  page.once("dialog", (d) => (dialogText = d.message()));
  const row = page.locator("main li", { has: page.getByRole("button", { name: "카페 위로", exact: true }) }).last();
  await row.getByRole("button", { name: "삭제" }).click();
  await settled();
  check("US5-8 소분류 삭제 확인 창 문구", dialogText === "'카페' 소분류를 지울까요? 글은 '여행'에 남아요.", dialogText);
  const subs = await subNames("여행");
  check("US5-8 소분류만 지워지고 남은 소분류 0부터", subs.map((s) => s.name).join() === "맛집" && contiguous(subs), JSON.stringify(subs));
  const posts = (await one("SELECT count(*)::int AS c FROM posts WHERE category_id = $1", [travelId])).c;
  check("US5-8 글은 대분류 \"여행\"에 그대로", posts === 5, `${posts}개`);
  if (!hasSubcolumn) skip("US5-8 소분류 글 subcategory_id NULL·category_id 유지", POST3);
}

// US5-9 대분류 삭제: 취소 → 그대로, 수락 → 대분류·소분류 삭제, 글 남고 카테고리 없음, updated_at 그대로
{
  let dialogText = "";
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => ((dialogText = d.message()), d.dismiss()));
  await catRow("여행").getByRole("button", { name: "삭제" }).first().click();
  await page.waitForTimeout(300);
  check("US5-9 대분류 삭제 확인 창 문구", dialogText === "'여행' 카테고리를 지울까요? 글은 남고 '카테고리 없음'이 돼요.", dialogText);
  check("US5-9 취소 → 그대로", (await catNames()).some((c) => c.name === "여행") && (await subNames("여행")).length === 1);
  page.once("dialog", (d) => d.accept());
  await catRow("여행").getByRole("button", { name: "삭제" }).first().click();
  await settled();
  const cats = await catNames();
  const subsLeft = (await one("SELECT count(*)::int AS c FROM subcategories WHERE category_id = $1", [travelId])).c;
  const posts = (await db.query("SELECT category_id, updated_at FROM posts WHERE blog_id = $1 AND title LIKE '여행 글%'", [owner.blog_id])).rows;
  check("US5-9 수락 → 대분류·그 소분류 삭제, 남은 대분류 0부터", !cats.some((c) => c.name === "여행") && subsLeft === 0 && contiguous(cats), JSON.stringify(cats));
  check("US5-9 글 5개는 남고 카테고리 없음", posts.length === 5 && posts.every((p) => p.category_id === null));
  check("US5-9 글 updated_at 그대로", posts.every((p) => new Date(p.updated_at).toISOString() === "2026-01-01T00:00:00.000Z"));
  page.on("dialog", (d) => d.accept());
}

// US5-10 조작: 다른 블로그 ID·범위 밖·문자 → 이름 바꾸기 `잘못된 요청이에요`, 그 밖은 문구 없이 변화 없음, 500 없음
{
  // 다른 회원의 대분류·소분류 (DB로 준비)
  const oCat = await one("SELECT id FROM categories WHERE blog_id = $1 LIMIT 1", [other.blog_id]);
  const oSub = await one("INSERT INTO subcategories (category_id, name) VALUES ($1, '남의 소분류') RETURNING id", [oCat.id]);
  const oSub2 = await one("INSERT INTO subcategories (category_id, name, position) VALUES ($1, '남의 소분류2', 1) RETURNING id", [oCat.id]);
  const snapshot = async () =>
    JSON.stringify([
      (await db.query("SELECT id, name, position FROM categories WHERE blog_id = $1 ORDER BY id", [other.blog_id])).rows,
      (await db.query("SELECT id, name, position FROM subcategories WHERE category_id = $1 ORDER BY id", [oCat.id])).rows,
    ]);
  const before = await snapshot();

  await page.goto(`${BASE}/settings/blog`);
  const capture = async (doIt) => {
    const reqP = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
    await doIt();
    const r = await reqP;
    await settled();
    return { actionId: r.headers()["next-action"], contentType: r.headers()["content-type"] };
  };
  const send = (c, args) =>
    page.evaluate(
      async ({ c, body }) => {
        const res = await fetch(location.href, { method: "POST", headers: { "Next-Action": c.actionId, Accept: "text/x-component", "Content-Type": c.contentType }, body });
        return { status: res.status, text: await res.text() };
      },
      { c, body: JSON.stringify(args) },
    );
  // 순서 바꾸기·이름 바꾸기·삭제 요청을 잡는다 (공부 ▼, 맛집(공부) ▼ 를 눌러 잡고 다시 되돌린다)
  const moveCat = await capture(() => page.getByRole("button", { name: "공부 아래로", exact: true }).click());
  await page.getByRole("button", { name: "공부 위로", exact: true }).click();
  await settled();
  await addSub("공부", "임시");
  const moveSub = await capture(() => catRow("공부").getByRole("button", { name: "맛집 아래로", exact: true }).click());
  await catRow("공부").getByRole("button", { name: "맛집 위로", exact: true }).click();
  await settled();
  await catRow("공부").getByRole("button", { name: "이름 바꾸기" }).first().click();
  const renameCat = await capture(() => page.locator("main li", { has: page.getByLabel("카테고리 이름", { exact: true }) }).getByRole("button", { name: "저장" }).click());
  const subRow = page.locator("main li", { has: page.getByRole("button", { name: "임시 위로", exact: true }) }).last();
  await subRow.getByRole("button", { name: "이름 바꾸기" }).click();
  const renameSub = await capture(() => page.locator("main li", { has: page.getByLabel("소분류 이름", { exact: true }) }).last().getByRole("button", { name: "저장" }).click());
  const delSub = await capture(() => page.locator("main li", { has: page.getByRole("button", { name: "임시 위로", exact: true }) }).last().getByRole("button", { name: "삭제" }).click());
  await addCategory("지울것");
  const delCat = await capture(() => catRow("지울것").getByRole("button", { name: "삭제" }).first().click());
  // 소분류 추가: 묶은 인자(대분류 ID)가 폼의 "0" 칸 [대분류ID, 이전 상태, "$K1"] 에 들어간다
  if (!(await catRow("공부").getByLabel("새 소분류 이름").count())) await catRow("공부").getByRole("button", { name: "소분류 추가" }).click();
  await catRow("공부").getByLabel("새 소분류 이름").fill("잡기");
  const addSubReq = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await catRow("공부").getByRole("button", { name: "추가", exact: true }).click();
  const addSubId = (await addSubReq).headers()["next-action"];
  await settled();
  const sendAddSub = (catId) =>
    page.evaluate(
      async ({ id, catId }) => {
        const fd = new FormData();
        fd.append("_1_name", "조작");
        fd.append("0", JSON.stringify([catId, {}, "$K1"]));
        const res = await fetch(location.href, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: fd });
        return { status: res.status, text: await res.text() };
      },
      { id: addSubId, catId },
    );

  const BAD = "잘못된 요청이에요";
  for (const [label, id] of [["다른 블로그 ID", oCat.id], ["99999999999", HUGE], ['"abc"', "abc"], ["1.5", 1.5]]) {
    const r = await send(renameCat, [id, "조작 이름"]);
    check(`US5-10 대분류 이름 바꾸기 ${label} → \`${BAD}\``, r.status === 200 && r.text.includes(BAD), `HTTP ${r.status}`);
  }
  for (const [label, id] of [["다른 블로그 ID", oSub.id], ["99999999999", HUGE], ['"abc"', "abc"]]) {
    const r = await send(renameSub, [id, "조작 이름"]);
    check(`US5-10 소분류 이름 바꾸기 ${label} → \`${BAD}\``, r.status === 200 && r.text.includes(BAD), `HTTP ${r.status}`);
  }
  const quiet = [];
  for (const id of [oCat.id, HUGE, "abc", 1.5]) {
    quiet.push(await send(delCat, [id]));
    quiet.push(await send(moveCat, [id, 1]));
    quiet.push(await sendAddSub(id));
  }
  for (const id of [oSub.id, HUGE, "abc"]) {
    quiet.push(await send(delSub, [id]));
    quiet.push(await send(moveSub, [id, -1]));
  }
  quiet.push(await send(moveCat, [oCat.id, "x"]));
  quiet.push(await send(moveSub, [oSub2.id, -1]));
  check("US5-10 삭제·순서·소분류 추가 조작 → 500 없음", quiet.every((r) => r.status === 200), quiet.map((r) => r.status).join(","));
  check("US5-10 삭제·순서·소분류 추가 조작 → 문구 없음", quiet.every((r) => ![BAD, "이미 있는 카테고리예요", "카테고리 이름을"].some((m) => r.text.includes(m))));
  check("US5-10 다른 회원의 대분류·소분류 그대로", (await snapshot()) === before);
  const mine = await catNames();
  check("US5-10 내 대분류도 순서 그대로·0부터", contiguous(mine), JSON.stringify(mine));
}

// FR-005 소분류가 있는 회원 삭제 → 오류 없이 CASCADE (소분류 글은 post 단계 3 뒤)
{
  const del = await db.query("DELETE FROM users WHERE id = $1", [other.id]).then(() => "ok", (e) => e.message);
  const left = (await one("SELECT count(*)::int AS c FROM categories WHERE blog_id = $1", [other.blog_id])).c;
  check("FR-005 소분류가 있는 회원 삭제 → 오류 없이 대분류·소분류 함께 삭제", del === "ok" && left === 0, del);
  if (!hasSubcolumn) skip("FR-005 소분류 글이 있는 회원 삭제 (posts_clear_subcategory 트리거)", POST3);
  skip("US5-11 글쓰기 대분류·소분류 두 칸", "post 단계 3 (003-post e2e/post-categories.mjs)");
}

// 375px 관리 화면·블로그 홈 가로 스크롤 0
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: await own.ctx.storageState() });
  const p = await ctx.newPage();
  for (const path of ["/settings/blog", `/@${OWNER}`]) {
    await p.goto(`${BASE}${path}`);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`375px ${path} 가로 스크롤 0`, overflow <= 0, `${overflow}px`);
  }
  await p.goto(`${BASE}/settings/blog`);
  await p.screenshot({ path: `${outDir}/ct-03-settings-375.png`, fullPage: true });
  await ctx.close();
}

const errors = allErrors.flat();
check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
