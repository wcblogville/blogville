// 글의 대분류·소분류 (POST-03 / US5, quickstart §4)
// 사용: 개발 서버를 띄운 상태에서 node e2e/post-categories.mjs <스크린샷 폴더>
// 실행마다 새 회원 A·B를 만들고, 대분류·소분류는 DB로 준비한다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctx.newPage();
const errors = collectErrors(a);
const n = Date.now() % 100_000_000;
const idA = `pca${n}`;
const idB = `pcb${n}`;
await loginDev(a, idA);
const ctxB = await browser.newContext();
await loginDev(await ctxB.newPage(), idB);
const blogOf = async (id) => (await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [id])).id;
const blogA = await blogOf(idA);
const blogB = await blogOf(idB);

const cat = async (blog, name, position) => (await one("INSERT INTO categories (blog_id, name, position) VALUES ($1, $2, $3) RETURNING id", [blog, name, position])).id;
const sub = async (category, name, position) => (await one("INSERT INTO subcategories (category_id, name, position) VALUES ($1, $2, $3) RETURNING id", [category, name, position])).id;
// 새 블로그의 기본 대분류는 지우고 이 시험의 것만 둔다
await db.query("DELETE FROM categories WHERE blog_id = ANY($1)", [[blogA, blogB]]);
const dev = await cat(blogA, "개발", 1);
const life = await cat(blogA, "일상", 0);
const git = await sub(dev, "Git", 0);
const next = await sub(dev, "Next", 1);
await sub(life, "산책", 0);
const otherCat = await cat(blogB, "남의 것", 0);

const options = (label) => a.getByLabel(label).locator("option").allInnerTexts();
async function openWrite() {
  await a.goto(`${BASE}/write`);
  await a.locator(".ProseMirror").waitFor();
}
async function fill(title) {
  await a.getByPlaceholder("제목").fill(title);
  await a.locator(".ProseMirror").click();
  await a.keyboard.type("카테고리 글");
}
const postIdOf = () => Number(new URL(a.url()).pathname.match(/\/(\d+)$/)[1]);
/** 선택 칸에 없는 값을 넣어 보낸다 (화면 조작) */
const forceOption = (label, value) =>
  a.getByLabel(label).evaluate((s, v) => {
    s.disabled = false;
    s.add(new Option("조작", String(v)));
    s.value = String(v);
  }, value);

// US5-1·2 선택지
await openWrite();
check("US5-1 대분류 첫 항목 `카테고리 없음`·관리 순서", (await options("대분류")).join() === "카테고리 없음,일상,개발", (await options("대분류")).join());
check("US5-2 대분류 고르기 전 소분류 막힘", await a.getByLabel("소분류").isDisabled());
await a.getByLabel("대분류").selectOption({ label: "개발" });
check("US5-2 소분류는 고른 대분류 것만", (await options("소분류")).join() === "소분류 없음,Git,Next", (await options("소분류")).join());
await a.getByLabel("소분류").selectOption({ label: "Git" });
await a.getByLabel("대분류").selectOption({ label: "일상" });
check("US5-3 대분류를 바꾸면 소분류 풀림", (await a.getByLabel("소분류").inputValue()) === "" && (await options("소분류")).join() === "소분류 없음,산책");
await a.screenshot({ path: `${outDir}/post-categories-write.png` });

// 개발 › Git 으로 발행 → 배지
await a.getByLabel("대분류").selectOption({ label: "개발" });
await a.getByLabel("소분류").selectOption({ label: "Git" });
await fill("Git 글");
await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/\d+(\?new=1)?$/);
const gitPost = postIdOf();
const badge = a.locator(`a[href="/@${idA}?category=${dev}&sub=${git}"]`);
check("US5 상세 배지 `개발 › Git`·링크", (await badge.innerText()) === "개발 › Git");
check("US5 배지 누르는 영역 44px", (await badge.boundingBox()).height >= 44);
await badge.click();
await a.waitForURL(/sub=/);
check("US5 배지 → 소분류 글 목록", (await a.locator("article h3").allInnerTexts()).join() === "Git 글");
const card = (await a.locator("article").first().innerText()).includes("개발 › Git");
check("US5 목록 카드 배지 `개발 › Git`", card);
await a.goto(`${BASE}/@${idA}?category=${dev}`);
check("US5 대분류로 거르면 소분류 글 포함", (await a.locator("article h3").allInnerTexts()).includes("Git 글"));

// 대분류만, 카테고리 없음
await openWrite();
await a.getByLabel("대분류").selectOption({ label: "개발" });
await fill("개발만 글");
await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/\d+(\?new=1)?$/);
check("US5-4 소분류는 선택 사항 → 배지 `개발`", (await a.locator(`a[href="/@${idA}?category=${dev}"]`).innerText()) === "개발");
await openWrite();
await fill("카테고리 없는 글");
await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/\d+(\?new=1)?$/);
check("US5-5 카테고리 없음 → 배지 없음", (await a.locator(`a[href*="?category="]`).count()) === 0);

// 조작: 다른 대분류의 소분류 → 잘못된 요청이에요 + 입력값 유지
await openWrite();
await a.getByLabel("대분류").selectOption({ label: "일상" });
await fill("엇갈린 소분류");
await a.getByLabel("태그").fill("남는다");
await forceOption("소분류", git);
await a.getByRole("button", { name: "발행하기" }).click();
await a.getByText("잘못된 요청이에요").waitFor({ timeout: 10000 }).catch(() => {});
check("US5-6 다른 대분류 소분류 조작 → `잘못된 요청이에요`", (await a.getByText("잘못된 요청이에요").isVisible()) && a.url().endsWith("/write"));
check("US5-6 입력값 유지", (await a.getByPlaceholder("제목").inputValue()) === "엇갈린 소분류" && (await a.getByLabel("태그").inputValue()) === "남는다");
// 범위 밖 번호
await openWrite();
await fill("범위 밖 소분류");
await a.getByLabel("대분류").selectOption({ label: "개발" });
await forceOption("소분류", "99999999999");
await a.getByRole("button", { name: "발행하기" }).click();
await a.getByText("잘못된 요청이에요").waitFor({ timeout: 10000 }).catch(() => {});
check("US5-9 소분류 99999999999 → `잘못된 요청이에요`", await a.getByText("잘못된 요청이에요").isVisible());

// 남의·없는 대분류 → 카테고리 없음으로 저장
for (const [name, value] of [
  ["남의 대분류", otherCat],
  ["없는 대분류", 2_000_000_000],
]) {
  await openWrite();
  await fill(name);
  await forceOption("대분류", value);
  await a.getByRole("button", { name: "발행하기" }).click();
  await a.waitForURL(/\/\d+(\?new=1)?$/);
  const p = await one("SELECT category_id, subcategory_id FROM posts WHERE id = $1", [postIdOf()]);
  check(`US5-7 ${name} → 카테고리 없음`, p.category_id === null && p.subcategory_id === null);
}

// 수정 화면에 저장된 대분류·소분류, 이름 변경 반영
await a.goto(`${BASE}/write/${gitPost}`);
await a.locator(".ProseMirror").waitFor();
check("US5 수정 화면 저장된 대분류·소분류", (await a.getByLabel("대분류").inputValue()) === String(dev) && (await a.getByLabel("소분류").inputValue()) === String(git));
await db.query("UPDATE subcategories SET name = 'Git 기초' WHERE id = $1", [git]);
await a.goto(`${BASE}/@${idA}/${gitPost}`);
check("US5-8 이름 변경 반영", (await a.locator(`a[href*="sub=${git}"]`).innerText()) === "개발 › Git 기초");

// 소분류 삭제 → 대분류만, 대분류 삭제 → 없음 (Edge Cases)
await db.query("DELETE FROM subcategories WHERE id = $1", [git]);
const afterSub = await one("SELECT category_id, subcategory_id FROM posts WHERE id = $1", [gitPost]);
check("Edge 소분류 삭제 → 글은 대분류에 남음", afterSub.category_id === dev && afterSub.subcategory_id === null);
await db.query("UPDATE posts SET subcategory_id = $2 WHERE id = $1", [gitPost, next]);
await db.query("DELETE FROM categories WHERE id = $1", [dev]);
const afterCat = await one("SELECT category_id, subcategory_id FROM posts WHERE id = $1", [gitPost]);
check("Edge 대분류 삭제 → 글은 남고 카테고리 없음", afterCat.category_id === null && afterCat.subcategory_id === null);
await a.goto(`${BASE}/write/${gitPost}`);
await a.locator(".ProseMirror").waitFor();
check("Edge 지워진 카테고리는 수정 화면에서 비어 있음", (await a.getByLabel("대분류").inputValue()) === "");

// 375px 두 칸 줄바꿈, 가로 스크롤 없음
await a.setViewportSize({ width: 375, height: 800 });
await openWrite();
const overflow = await a.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375px 글쓰기 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
await a.screenshot({ path: `${outDir}/post-categories-375.png`, fullPage: true });

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
