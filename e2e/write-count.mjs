// 글쓰기 화면의 글자 수·보상 안내가 서버의 실제 보상 판단과 같다 (POST-01, GAME-05, #18)
// 사용: 개발 서버를 띄운 상태에서 node e2e/write-count.mjs <스크린샷 폴더>
// 하루 보상 횟수(글 3번)에 걸리지 않도록 실행할 때마다 새 회원을 만든다
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
await loginDev(page, `cnt${Date.now() % 100_000_000}`);

/** 글을 쓰고, 화면 글자 수·보상 안내를 읽은 뒤 발행해서 서버 판단과 비교한다 */
async function write(name, typeBody, wantLength, wantReward) {
  await page.goto(`${BASE}/write`);
  await page.locator(".ProseMirror").waitFor();
  await page.getByPlaceholder("제목").fill(name);
  await page.locator(".ProseMirror").click();
  await typeBody();
  const status = await page.locator("p", { hasText: /\d+자 ·/ }).innerText();
  const shown = Number(status.match(/([\d,]+)자/)[1].replace(/,/g, ""));
  const promised = status.includes("저장하면");
  await page.screenshot({ path: `${outDir}/80-${wantReward ? "reward" : "no-reward"}.png` });
  await page.getByRole("button", { name: "발행하기" }).click();
  await page.waitForURL(/\/@cnt\d+\/\d+/);
  const rewarded = page.url().includes("new=reward");
  const postId = Number(page.url().match(/\/(\d+)\?/)[1]);
  const { rows } = await db.query("SELECT char_length(content_text)::int AS n FROM posts WHERE id = $1", [postId]);
  const server = rows[0].n;
  check(`${name}: 화면 ${shown}자 = 서버 ${server}자`, shown === server && shown === wantLength);
  check(`${name}: 화면 안내(${promised ? "보상" : "보상 없음"}) = 실제(${rewarded ? "보상" : "보상 없음"})`, promised === rewarded && rewarded === wantReward);
}

// 두 문단 49자 + 50자: 문단 사이 줄바꿈 1자 → 100자, 보상
await write(
  "두 문단",
  async () => {
    await page.keyboard.type("가".repeat(49));
    await page.keyboard.press("Enter");
    await page.keyboard.type("나".repeat(50));
  },
  100,
  true,
);

// 한 문단 50자 + Shift+Enter + 49자: 줄바꿈은 0자 → 99자, 보상 없음
await write(
  "Shift+Enter",
  async () => {
    await page.keyboard.type("가".repeat(50));
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("나".repeat(49));
  },
  99,
  false,
);

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
