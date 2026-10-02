// 글쓰기 → 보상 → 다른 회원의 공감·댓글 흐름
import { chromium } from "@playwright/test";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const browser = await chromium.launch();

// --- 작성자 ---
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const a = await ctxA.newPage();
const errA = collectErrors(a);
await loginDev(a, "tester1");
const before = await coins(a);

await a.goto(`${BASE}/write`);
await a.locator(".ProseMirror").waitFor();

// 발행이 오류로 막혀도 제목·카테고리·태그 입력값이 남는다 (POST-01, #16)
await a.getByPlaceholder("제목").fill("본문 없이 발행");
await a.getByLabel("카테고리").selectOption({ label: "일상" });
await a.getByPlaceholder(/태그/).fill("남아야 하는 태그");
await a.getByRole("button", { name: "발행하기" }).click();
await a.getByText("본문을 적어 주세요").waitFor();
await a.waitForTimeout(300); // React가 폼을 되돌리는 시점 뒤에 읽는다
const kept = {
  title: await a.getByPlaceholder("제목").inputValue(),
  category: await a.getByLabel("카테고리").evaluate((s) => s.selectedOptions[0].text),
  tags: await a.getByPlaceholder(/태그/).inputValue(),
};
if (kept.title !== "본문 없이 발행" || kept.category !== "일상" || kept.tags !== "남아야 하는 태그") {
  throw new Error(`오류 뒤 입력값이 사라졌어요: ${JSON.stringify(kept)}`);
}
console.log("오류 뒤 입력값 유지:", kept);
await a.getByLabel("카테고리").selectOption({ label: "카테고리 없음" });

await a.getByPlaceholder("제목").fill("Git 충돌 해결해 본 날");
await a.locator(".ProseMirror").click();
await a.getByRole("button", { name: "H2" }).click();
await a.keyboard.type("오늘 배운 것");
await a.keyboard.press("Enter");
await a.keyboard.type(
  "두 브랜치가 같은 줄을 서로 다르게 고치면 merge할 때 충돌이 난다. 충돌 표시를 읽고 남길 내용을 고른 다음 표시 세 줄을 지우고 add, commit 하면 끝이다. 생각보다 무섭지 않았다!",
);
await a.keyboard.press("Enter");
await a.getByRole("button", { name: "B", exact: true }).click();
await a.keyboard.type("핵심: git merge --abort 로 언제든 되돌릴 수 있다.");
await a.getByPlaceholder(/태그/).fill("git, merge, 회고");
await a.screenshot({ path: `${outDir}/10-write.png`, fullPage: true });
await a.getByRole("button", { name: "발행하기" }).click();
await a.waitForURL(/\/@tester1\/\d+/);
const postUrl = a.url().replace("?new=1", "");
await a.waitForLoadState("networkidle");
const after = await coins(a);
console.log("post:", postUrl, "coins", before, "→", after);
await a.screenshot({ path: `${outDir}/11-post.png`, fullPage: true });

// --- 다른 회원 ---
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const b = await ctxB.newPage();
const errB = collectErrors(b);
await loginDev(b, "tester2", "강아지");
const bBefore = await coins(b);
await b.goto(postUrl);
await b.getByRole("button", { name: /공감/ }).click();
await b.waitForTimeout(800);
await b.getByPlaceholder(/따뜻한 댓글/).fill("저도 오늘 충돌 해결했어요! 👍");
await b.getByRole("button", { name: "댓글 등록" }).click();
await b.getByText("저도 오늘 충돌 해결했어요!").waitFor();
await b.reload();
await b.waitForLoadState("networkidle");
console.log("tester2 coins", bBefore, "→", await coins(b));
await b.screenshot({ path: `${outDir}/12-post-by-other.png`, fullPage: true });

// 블로그 홈, 마을 소식
await b.goto(`${BASE}/@tester1`);
await b.screenshot({ path: `${outDir}/13-blog-home.png`, fullPage: true });
await b.goto(`${BASE}/feed`);
await b.screenshot({ path: `${outDir}/14-feed.png`, fullPage: true });

// 작성자 코인 (공감 받음 +2)
await a.reload();
await a.waitForLoadState("networkidle");
console.log("tester1 coins after like:", await coins(a));

console.log("errors:", [...errA, ...errB].length ? [...errA, ...errB] : "none");
await browser.close();
