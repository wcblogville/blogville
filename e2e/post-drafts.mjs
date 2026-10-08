// 새 글 임시 저장 (POST-08 / US10, SC-010, quickstart §4)
// 사용: 개발 서버를 띄운 상태에서 node e2e/post-drafts.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, timezoneId: "America/New_York" });
const a = await ctx.newPage();
const errors = collectErrors(a);
const n = Date.now() % 100_000_000;
const idA = `pda${n}`;
await loginDev(a, idA);

const draftStatus = () => a.locator("[data-draft-status]").innerText();
const draftKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("blogville:draft:")));
/** 새 글 화면을 연다. 불러올지 묻는 창이 뜨면 answer대로 답하고 문구를 돌려준다 */
async function openWrite(page, answer) {
  let asked = null;
  const onDialog = (d) => {
    asked = d.message();
    if (answer) d.accept();
    else d.dismiss();
  };
  page.on("dialog", onDialog);
  await page.goto(`${BASE}/write`);
  await page.locator(".ProseMirror").waitFor();
  await page.waitForTimeout(300);
  page.off("dialog", onDialog);
  return asked;
}

// US10-1 처음 안내 → 2초 뒤 `임시 저장됨 HH:mm` (한국 시간)
check("US10-1 질문 없음(임시 글 없음)", (await openWrite(a, true)) === null);
check("US10-1 처음 안내", (await draftStatus()) === "작성 중인 글은 이 브라우저에 자동 저장됩니다.");
await a.getByPlaceholder("제목").fill("임시 제목");
await a.getByRole("radio", { name: "🔒 비공개" }).click();
await a.locator(".ProseMirror").click();
await a.keyboard.press("Control+b");
await a.keyboard.type("굵은 본문");
await a.getByLabel("태그").fill("임시, 태그");
await a.waitForTimeout(2600);
const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
const st = await draftStatus();
check("US10-1 `임시 저장됨 HH:mm` 한국 시간", st === `임시 저장됨 ${kst}`, st);
check("US10 회원별 키", (await draftKeys(a)).length === 1);
await a.screenshot({ path: `${outDir}/post-drafts-saved.png` });

// US10-2 다시 열면 묻고, 확인 → 모든 칸 서식 포함
check("US10-2 불러오기 질문", (await openWrite(a, true)) === "작성 중이던 글이 있어요. 불러올까요?");
check("US10-2 제목", (await a.getByPlaceholder("제목").inputValue()) === "임시 제목");
check("US10-2 본문 서식", (await a.locator(".ProseMirror strong").innerText()) === "굵은 본문");
check("US10-2 공개 설정", (await a.getByRole("radio", { name: "🔒 비공개" }).getAttribute("aria-checked")) === "true");
check("US10-2 태그", (await a.getByLabel("태그").inputValue()) === "임시, 태그");
// US10-3 취소 → 빈 화면 (임시 글은 남음)
await openWrite(a, false);
check("US10-3 취소 → 빈 화면", (await a.getByPlaceholder("제목").inputValue()) === "");
check("US10-3 취소해도 바로 지우지 않음", (await draftKeys(a)).length === 1);

// US10-4 제목·본문이 비면 쓰지 않음
await a.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
await openWrite(a, true);
await a.getByLabel("태그").fill("태그만");
await a.waitForTimeout(2600);
check("US10-4 제목·본문이 비면 저장 안 함", (await draftKeys(a)).length === 0);

// US10-5 발행 실패 → 임시 글 남음, 발행 성공 → 지워지고 다시 묻지 않음
await a.getByPlaceholder("제목").fill("실패할 글");
await a.waitForTimeout(2600);
await a.getByRole("button", { name: "발행하기" }).click();
await a.getByText("본문을 적어 주세요").waitFor();
check("US10-6 발행 실패 뒤 임시 글 남음", (await draftKeys(a)).length === 1);
await a.locator(".ProseMirror").click();
await a.keyboard.type("이제 본문");
// 2초 안에 바로 발행
await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/@[a-z0-9_]+\/\d+/);
await a.getByText("🎉 글을 발행했어요!").waitFor();
await a.waitForTimeout(500);
check("US10-5 발행 성공 → 임시 글 지움", (await draftKeys(a)).length === 0);
check("US10-5 다음 새 글 화면에서 묻지 않음", (await openWrite(a, true)) === null);

// US10-8 수정 화면에는 임시 저장 없음
await a.goto(`${BASE}/@${idA}`);
await a.locator("article a").first().click();
await a.waitForURL(/\/@[a-z0-9_]+\/\d+$/);
const id = new URL(a.url()).pathname.split("/").pop();
await a.goto(`${BASE}/write/${id}`);
await a.locator(".ProseMirror").waitFor();
await a.getByPlaceholder("제목").fill("고치는 중");
await a.waitForTimeout(2600);
check("US10-8 수정 화면 임시 저장 없음", (await draftKeys(a)).length === 0 && (await a.locator("[data-draft-status]").count()) === 0);

// 로그아웃 때 지움 (FR-063)
await openWrite(a, true);
await a.getByPlaceholder("제목").fill("로그아웃 전 글");
await a.waitForTimeout(2600);
check("로그아웃 전 임시 글 있음", (await draftKeys(a)).length === 1);
await a.getByRole("button", { name: "로그아웃" }).click();
await a.waitForURL((u) => new URL(u).pathname === "/");
check("로그아웃 때 임시 글 지움", (await draftKeys(a)).length === 0);

// US10-7 회원 B에게 A의 임시 글 안 보임 (같은 브라우저)
await loginDev(a, idA);
await openWrite(a, true);
await a.getByPlaceholder("제목").fill("A의 임시 글");
await a.waitForTimeout(2600);
// 로그아웃 버튼을 거치지 않고 회원만 바꾼다 (같은 브라우저 저장소에 A의 임시 글이 남은 채)
await ctx.clearCookies();
await loginDev(a, `pdb${n}`);
check("US10-7 회원 B에게 A의 임시 글을 묻지 않음", (await openWrite(a, true)) === null);

// US10-9 localStorage를 쓸 수 없는 브라우저에서도 발행 정상
const ctxNo = await browser.newContext();
await ctxNo.addInitScript(() => {
  const broken = () => {
    throw new Error("저장 막힘");
  };
  Object.defineProperty(window, "localStorage", { get: broken });
});
const c = await ctxNo.newPage();
const errC = collectErrors(c);
await loginDev(c, `pdc${n}`);
await openWrite(c, true);
await c.getByPlaceholder("제목").fill("저장 막힌 브라우저");
await c.locator(".ProseMirror").click();
await c.keyboard.type("그래도 발행된다");
await c.waitForTimeout(2600);
await c.getByRole("button", { name: "발행하기" }).click();
await c.waitForURL(/\/@[a-z0-9_]+\/\d+/);
check("US10-9 localStorage 막혀도 발행 정상", await c.getByText("🎉 글을 발행했어요!").isVisible());
check("US10-9 화면 오류 없음", errC.filter((e) => e.startsWith("pageerror")).length === 0, errC.join(" | "));

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
