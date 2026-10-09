// 휴대폰 화면 확인 (사용자 결정 2026-10-09): 광장 없이 내 블로그가 첫 화면이고, 아래 탭으로 다닌다.
// 헤더 겹침·블로그 홈 버튼 줄바꿈 (이슈 #5)도 본다
// 사용: 개발 서버를 띄운 상태에서 node e2e/mobile.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

const outDir = process.argv[2] ?? "e2e-shots";
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const phoneSize = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };
const ME = "mobile01";

// ── 휴대폰(375px): 광장 대신 내 블로그 + 아래 탭 ──
const phone = await browser.newContext(phoneSize);
const p = await phone.newPage();
const errors = collectErrors(p);
await loginDev(p, ME);
await p.goto(`${BASE}/town`);
await p.waitForURL(new RegExp(`/@${ME}$`), { timeout: 15000 }).catch(() => {});
check("휴대폰: 광장(/town) 대신 내 블로그로", new URL(p.url()).pathname === `/@${ME}`, p.url());
await p.waitForTimeout(1500); // 게임이 늦게라도 뜨는지 조금 기다려 본다
check("휴대폰: 광장(게임)을 띄우지 않음", (await p.locator("canvas").count()) === 0);
const tabs = p.locator("[data-mobile-tabs]");
for (const name of ["내 블로그", "마을 소식", "상점", "알림", "메뉴"]) {
  check(`휴대폰 아래 탭: '${name}'`, await tabs.getByRole("link", { name: new RegExp(name) }).isVisible());
}
check("아래 탭: 지금 화면(내 블로그) 표시", (await tabs.getByRole("link", { name: /내 블로그/ }).getAttribute("aria-current")) === "page");
check("휴대폰: 우리 집 🚪 문 숨김 (광장이 없다)", !(await p.locator("[data-house-door]").isVisible()));
await p.screenshot({ path: `${outDir}/m1-phone-blog.png` });

// 페이지 끝까지 내려도 아래 탭이 내용(바닥글)을 가리지 않는다
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(300);
const footerBox = await p.locator("footer").last().boundingBox();
const tabsBox = await tabs.boundingBox();
check("아래 탭이 바닥글을 가리지 않음", footerBox.y + footerBox.height <= tabsBox.y + 1, `바닥글 끝 ${Math.round(footerBox.y + footerBox.height)} / 탭 ${Math.round(tabsBox.y)}`);

await tabs.getByRole("link", { name: /상점/ }).click();
await p.waitForURL(/\/shop$/);
check("아래 탭: 상점으로 이동, 상점 표시", (await tabs.getByRole("link", { name: /상점/ }).getAttribute("aria-current")) === "page");

// ── 이슈 #5: 헤더가 겹치지 않고 레벨이 보인다. 휴대폰 회원에게는 나가기가 없다 (아래 탭으로 다닌다) ──
const banner = p.getByRole("banner");
check("휴대폰 회원: 헤더에 나가기 없음", !(await banner.getByRole("link", { name: /나가기/ }).isVisible()));
check("휴대폰 회원: 헤더에 Blogville 로고", await banner.getByRole("link", { name: "Blogville" }).isVisible());
check("GAME-02 휴대폰 헤더에도 레벨이 보임", await banner.getByTitle("레벨").isVisible());
await p.screenshot({ path: `${outDir}/m2-header-shop.png` });

// ── ☰ 메뉴: 내 프로필 + 나머지 장소 ──
await tabs.getByRole("link", { name: /메뉴/ }).click();
await p.waitForURL(/\/town\?menu=1$/);
const menu = p.locator("[data-town-menu]");
await menu.waitFor();
check("☰ 메뉴: 광장으로 옮기지 않고 메뉴", new URL(p.url()).search === "?menu=1" && (await menu.isVisible()));
check("☰ 메뉴: 내 프로필 (블로그 이름·코인·경험치)", (await menu.locator("[data-profile-blog]").isVisible()) && (await menu.locator("[data-profile-coins]").isVisible()) && (await menu.locator("[data-profile-exp]").isVisible()));
for (const name of ["글쓰기", "출석 체크", "꾸미기", "지갑", "동물 농장", "낚시터"]) {
  check(`☰ 메뉴: '${name}' 버튼`, await menu.getByRole("link", { name: new RegExp(name) }).isVisible());
}
await p.screenshot({ path: `${outDir}/m3-phone-menu.png`, fullPage: true });

// 글쓰기는 편집기가 화면을 다 쓰도록 아래 탭을 숨긴다
await menu.getByRole("link", { name: /글쓰기/ }).click();
await p.waitForURL(/\/write$/);
await p.locator(".ProseMirror").waitFor();
check("글쓰기: 아래 탭 숨김", (await tabs.count()) === 0 || !(await tabs.isVisible()));

// ── 이슈 #5: 블로그 홈 버튼 글자가 두 줄로 깨지지 않는다 ──
await p.goto(`${BASE}/@${ME}`);
const main = p.locator("main");
for (const name of ["글쓰기", "꾸미기", "관리"]) {
  const box = await main.getByRole("link", { name: new RegExp(name) }).first().boundingBox();
  check(`이슈 #5 '${name}' 버튼이 한 줄`, box.height < 48, `높이 ${Math.round(box.height)}px`);
}
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375px: 가로 스크롤 없음", overflow <= 0, `${overflow}px`);

// ── 휴대폰을 가로로 돌려도(높이가 낮은 터치 화면) 광장 대신 내 블로그 ──
const land = await browser.newContext({ ...phoneSize, viewport: { width: 812, height: 375 }, storageState: await phone.storageState() });
const lp = await land.newPage();
await lp.goto(`${BASE}/town`);
await lp.waitForURL(new RegExp(`/@${ME}$`), { timeout: 15000 }).catch(() => {});
await lp.waitForTimeout(1500);
check("휴대폰 가로: 광장 대신 내 블로그, 아래 탭", (await lp.locator("canvas").count()) === 0 && new URL(lp.url()).pathname === `/@${ME}` && (await lp.locator("[data-mobile-tabs]").isVisible()));
await lp.screenshot({ path: `${outDir}/m4-phone-landscape.png` });

// ── 데스크톱은 그대로 광장 (아래 탭 없음) ──
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await phone.storageState() });
const d = await desk.newPage();
await d.goto(`${BASE}/town`);
await d.locator("canvas").waitFor();
check("데스크톱: 광장(게임)이 뜸", (await d.locator("canvas").count()) === 1 && new URL(d.url()).pathname === "/town");
check("데스크톱: 간단 메뉴·아래 탭은 숨김", !(await d.locator("[data-town-menu]").isVisible()) && !(await d.locator("[data-mobile-tabs]").isVisible()));
await d.goto(`${BASE}/@${ME}`);
check("데스크톱: 블로그에 나가기·🚪 문", (await d.getByRole("banner").getByRole("link", { name: /나가기/ }).isVisible()) && (await d.locator("[data-house-door]").isVisible()));

// ── 로그인하지 않은 방문자는 휴대폰에서 간단 메뉴 (아래 탭 없음) ──
const guest = await browser.newContext(phoneSize);
const g = await guest.newPage();
await g.goto(`${BASE}/town`);
const guestMenu = g.locator("[data-town-menu]");
await guestMenu.waitFor();
check("방문자 휴대폰: 마을 소식·시작하기 버튼", (await guestMenu.getByRole("link", { name: /마을 소식/ }).isVisible()) && (await guestMenu.getByRole("link", { name: /시작하기/ }).isVisible()));
check("방문자 휴대폰: 아래 탭 없음", (await g.locator("[data-mobile-tabs]").count()) === 0);
await g.screenshot({ path: `${outDir}/m5-town-guest.png`, fullPage: true });

check("콘솔 오류 없음", errors.length === 0, errors.join(" | "));
console.log(results.join("\n"));
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
