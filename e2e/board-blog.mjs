// 마을 게시판 출석 체크 창 + 광장 이름표 + 블로그 주인 도구·위젯 (사용자 요청 2026-10-11)
// "마을 게시판 들어가면 출석체크 창 없음, 내 블로그 들어갔을 때 글쓰기랑 다른 부가기능들이 부족한 것 같음,
//  옷가게나 상점 아래 적혀있는 부가 설명들은 없애줘"
// 사용: 개발 서버를 띄운 상태에서 node e2e/board-blog.mjs <스크린샷 폴더>
// 실행마다 새 회원 둘(주인 O, 손님 V)을 만들고, 출석·글·댓글·태그·방문은 pg로 넣어 준비한다
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
const allErrors = [];
const n = Date.now() % 100_000_000;
const OWNER = `bo${n}`;
const VISITOR = `bv${n}`;
const desktop = { viewport: { width: 1280, height: 900 } };
const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };

const kstDate = (offset = 0) => new Date(Date.now() + 9 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);
const TODAY = kstDate();

async function fresh(opts = desktop, storageState) {
  const ctx = await browser.newContext({ ...opts, storageState });
  const page = await ctx.newPage();
  allErrors.push(collectErrors(page));
  return { ctx, page };
}

const own = await fresh();
await loginDev(own.page, OWNER);
const vis = await fresh();
await loginDev(vis.page, VISITOR, "여자 주민");
const owner = await one("SELECT u.id AS user_id, b.id AS blog_id, b.slug FROM users u JOIN blogs b ON b.owner_id = u.id WHERE u.username = $1", [OWNER]);
const visitor = await one("SELECT u.id AS user_id FROM users u WHERE u.username = $1", [VISITOR]);

// ══ 1. 마을 게시판 → 출석 체크 창 ══
{
  // 오늘 출석을 지우고 그저께 1일차·어제 2일차를 넣는다 → 다음 화면에서 오늘 3일차 자동 출석
  const uid = owner.user_id;
  await db.query("DELETE FROM point_ledger WHERE user_id = $1 AND reason = 'attendance' AND ref_id = $2", [uid, TODAY]);
  await db.query("DELETE FROM attendances WHERE user_id = $1", [uid]);
  for (const [ago, day] of [[2, 1], [1, 2]]) await db.query("INSERT INTO attendances (user_id, date, cycle_day) VALUES ($1, $2, $3)", [uid, kstDate(-ago), day]);
  const reward3 = await one("SELECT exp, coins FROM attendance_rewards WHERE day = 3");
  const reward4 = await one("SELECT exp, coins FROM attendance_rewards WHERE day = 4");

  const page = own.page;
  await page.goto(`${BASE}/town`);
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: /메뉴/ }).click();
  const panel = page.locator("[data-town-panel]");
  await panel.getByRole("button", { name: /텔레포트/ }).click();
  await panel.locator('[data-spot="board"]').click();
  await page.waitForTimeout(900);
  await page.locator("canvas").focus().catch(() => {});
  await page.keyboard.press("Space");
  await page.waitForURL(/\/feed/, { timeout: 15000 }).catch(() => {});
  check("광장 게시판 앞 Space → 마을 소식", new URL(page.url()).pathname === "/feed", page.url());

  const win = page.locator("dialog[data-attendance-window]");
  check("게시판으로 들어오면 출석 체크 창이 먼저 열림", await win.waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false));
  await page.waitForTimeout(300);
  check("새로고침해도 다시 뜨지 않게 ?board=1을 지움", !new URL(page.url()).searchParams.has("board"), page.url());
  const text = await win.innerText();
  check("창: `오늘 3일차 출석 완료 ✅`", text.includes("오늘 3일차 출석 완료 ✅"), text.slice(0, 120).replace(/\n/g, " "));
  check("창: 받은 보상 = 3일차 보상", (await win.locator("[data-attendance-got]").innerText()).includes(`✨ ${reward3.exp}`) && (await win.locator("[data-attendance-got]").innerText()).includes(`🪙 ${reward3.coins}`));
  const cells = await win.locator("[data-reward-day]").allInnerTexts();
  check("창: 1~7일차 보상표", cells.length === 7 && cells[0].includes("1일차") && cells[6].includes("7일차"), String(cells.length));
  check("창: 지난 일차 `받음`, 오늘 `오늘`, 다음 `내일`", cells[0].includes("받음") && cells[1].includes("받음") && cells[2].includes("오늘") && cells[3].includes("내일"), cells.slice(0, 4).join(" | ").replace(/\n/g, " "));
  check("창: 내일 받을 보상 안내", (await win.locator("[data-attendance-next]").innerText()).includes(`4일차 보상 ✨ ${reward4.exp} · 🪙 ${reward4.coins}`));
  const todayCell = win.locator(`[data-date="${TODAY}"]`);
  check("창: 이번 달 달력 오늘 칸 🌟 도장", (await todayCell.innerText()) === "🌟");
  const month = await one("SELECT count(*)::int AS n FROM attendances WHERE user_id = $1 AND date >= $2", [uid, `${TODAY.slice(0, 7)}-01`]);
  check("창: 달력 도장 수 = 이번 달 출석 수", (await win.locator("[data-date]").filter({ hasText: "🌟" }).count()) === month.n, `${month.n}`);
  check("창: [출석하기] 버튼 없음 (자동 출석)", (await win.getByRole("button", { name: /출석하기/ }).count()) === 0);
  await page.screenshot({ path: `${outDir}/board-attendance-1280.png` });

  await win.getByRole("button", { name: "출석 체크 창 닫기" }).click();
  check("[✕ 닫기] → 창 닫힘, 마을 소식 보임", !(await win.isVisible()) && (await page.getByRole("heading", { name: "📋 마을 소식" }).isVisible()));
  const strip = page.locator("[data-attendance-strip]");
  check("제목 아래 출석 띠 `오늘 출석 완료 ✅`", (await strip.innerText()).includes("오늘 출석 완료 ✅"));
  await strip.getByRole("button", { name: "📅 출석부 열기" }).click();
  check("[📅 출석부 열기] → 창 다시 열림", await win.isVisible());
  await page.keyboard.press("Escape");
  check("Esc → 창 닫힘", !(await win.isVisible()));
  await page.reload();
  check("새로고침하면 창은 닫힌 채", !(await page.locator("dialog[data-attendance-window]").isVisible()));
  // 저절로 열리는 것은 하루 한 번 (쿠키 bv_board_seen = 회원:한국 날짜, 사용자 요청 2026-10-12)
  const seen = (await own.ctx.cookies()).find((c) => c.name === "bv_board_seen");
  check("하루 한 번: 창을 연 날 쿠키 `회원:오늘`", decodeURIComponent(seen?.value ?? "") === `${uid}:${TODAY}`, seen?.value);
  await page.goto(`${BASE}/feed?board=1`);
  await page.waitForTimeout(1200);
  check("하루 한 번: 같은 날 게시판으로 다시 들어오면 창이 저절로 열리지 않음", !(await win.isVisible()));
  const tab2 = await own.ctx.newPage();
  await tab2.goto(`${BASE}/feed?board=1`);
  await tab2.waitForTimeout(1200);
  check("하루 한 번: 다른 탭에서도 열리지 않음", !(await tab2.locator("dialog[data-attendance-window]").isVisible()));
  await tab2.close();
  await page.locator("[data-attendance-strip]").getByRole("button", { name: "📅 출석부 열기" }).click();
  check("하루 한 번: [📅 출석부 열기]로는 언제든 열림", await win.isVisible());
  await page.keyboard.press("Escape");
  const ledger = await one("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'attendance' AND ref_id = $2", [uid, TODAY]);
  check("출석 보상은 하루 한 줄", ledger.n === 1, String(ledger.n));

  // 휴대폰: 창이 화면 안, 가로 스크롤 없음
  // 휴대폰 창 시험은 오늘 연 기록(쿠키)을 빼고 들어간다
  const ownState = await own.ctx.storageState();
  const m = await fresh(phone, { ...ownState, cookies: ownState.cookies.filter((c) => c.name !== "bv_board_seen") });
  await m.page.goto(`${BASE}/feed?board=1`);
  const mwin = m.page.locator("dialog[data-attendance-window]");
  check("375px 게시판 주소 → 출석 체크 창", await mwin.waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false));
  const box = await mwin.boundingBox();
  check("375px 창이 화면 너비 안", box && box.x >= 0 && box.x + box.width <= 375, box && `${Math.round(box.x)}+${Math.round(box.width)}`);
  const rewardTops = await mwin.locator("[data-reward-day]").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
  check("375px 보상표 7칸 한 줄", rewardTops === 1, String(rewardTops));
  await m.page.screenshot({ path: `${outDir}/board-attendance-375.png` });
  await m.ctx.close();

  // 방문자: 출석이 없으니 띠·창 없음
  const g = await fresh();
  await g.page.goto(`${BASE}/feed?board=1`);
  check("방문자 게시판 → 마을 소식만 (출석 띠·창 없음)", (await g.page.locator("[data-attendance-strip], dialog[data-attendance-window]").count()) === 0);
  await g.ctx.close();
}

// ══ 2. 광장 이름표: 설명 줄 없이 이름만 (Phaser 그림이라 스크린샷으로 본다) ══
{
  const page = own.page;
  await page.goto(`${BASE}/town`);
  await page.locator("canvas").waitFor();
  for (const spot of ["clothes", "shop"]) {
    await page.getByRole("button", { name: /메뉴/ }).click();
    await page.locator("[data-town-panel]").getByRole("button", { name: /텔레포트/ }).click();
    await page.locator(`[data-town-panel] [data-spot="${spot}"]`).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${outDir}/plaza-labels-${spot}-1280.png` });
  }
}

// ══ 3. 블로그 주인 도구 막대·옆 칸 위젯·블로그 안 검색 ══
{
  const KEY = `찾기${n}`;
  const TAG = `태그${n}`;
  const SECRET_TAG = `비밀태그${n}`;
  const blogId = owner.blog_id;
  const base = `${BASE}/@${owner.slug}`;
  const cat = await one("SELECT id FROM categories WHERE blog_id = $1 ORDER BY position LIMIT 1", [blogId]);
  /** 글 하나 (분 단위로 나이를 줘서 최신 순서를 정한다) */
  const post = async (title, text, visibility, views, agoMin) =>
    (
      await one(
        `INSERT INTO posts (blog_id, category_id, title, content_html, content_text, visibility, view_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() - make_interval(mins => $8)) RETURNING id`,
        [blogId, cat.id, title, `<p>${text}</p>`, text, visibility, views, agoMin],
      )
    ).id;
  const ids = {};
  for (let i = 1; i <= 6; i++) ids[`p${i}`] = await post(`보통 글 ${i}`, "평범한 하루", "public", i * 3, 60 - i);
  ids.hit = await post("인기 많은 글", `본문에 ${KEY} 있음`, "public", 99, 70);
  ids.secret = await post(`비밀 ${KEY} 일기`, "아무도 몰라", "private", 500, 1);
  const tagId = (await one("INSERT INTO tags (name) VALUES ($1) RETURNING id", [TAG])).id;
  const secretTagId = (await one("INSERT INTO tags (name) VALUES ($1) RETURNING id", [SECRET_TAG])).id;
  await db.query("INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2), ($3, $2), ($4, $5)", [ids.hit, tagId, ids.p1, ids.secret, secretTagId]);
  const c1 = (await one("INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, '공개 글에 단 댓글') RETURNING id", [ids.hit, visitor.user_id])).id;
  await db.query("INSERT INTO replies (comment_id, author_id, content) VALUES ($1, $2, '주인의 답글')", [c1, owner.user_id]);
  await db.query("INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, '비밀 글 메모')", [ids.secret, owner.user_id]);

  const sidebar = (page) => page.locator("[data-blog-sidebar]");
  const widgetText = async (page, key) => (await sidebar(page).locator(`[data-widget="${key}"]`).innerText()).replace(/\s+/g, " ");

  // 주인 1280
  const page = own.page;
  await page.goto(base);
  const bar = page.getByRole("navigation", { name: "내 블로그 관리" });
  const hrefOf = (name) => bar.getByRole("link", { name }).getAttribute("href");
  const tools = {
    write: await hrefOf("✏️ 새 글 쓰기"),
    manage: await hrefOf(/📝 글 관리/),
    cats: await hrefOf("🗂 카테고리 관리"),
    settings: await hrefOf("⚙️ 블로그 설정"),
    closet: await hrefOf("🎨 꾸미기"),
  };
  check("주인 도구 막대: 새 글 쓰기·글 관리·카테고리 관리·블로그 설정·꾸미기", JSON.stringify(tools) === JSON.stringify({ write: "/write", manage: "/settings/posts", cats: "/settings/blog#categories", settings: "/settings/blog", closet: "/closet" }), JSON.stringify(tools));
  const writeBox = await bar.getByRole("link", { name: "✏️ 새 글 쓰기" }).boundingBox();
  check("[✏️ 새 글 쓰기]가 크게 (높이 44px 이상)", writeBox.height >= 44 && writeBox.width >= 120, `${Math.round(writeBox.width)}×${Math.round(writeBox.height)}`);
  for (const path of Object.values(tools)) {
    const res = await page.request.get(`${BASE}${path.split("#")[0]}`);
    check(`도구 링크 ${path} 열림`, res.status() === 200, String(res.status()));
  }
  const listBox = await page.locator('section[aria-label="글 목록"]').boundingBox();
  const sideBox = await sidebar(page).boundingBox();
  check("1280px: 글 목록 왼쪽 + 옆 칸 오른쪽 300px", sideBox.x > listBox.x + listBox.width - 1 && Math.abs(sideBox.width - 300) < 2 && Math.abs(sideBox.y - listBox.y) < 2, `글 ${Math.round(listBox.width)}, 옆 칸 ${Math.round(sideBox.width)}`);
  const order = await sidebar(page).locator(":scope > *").evaluateAll((els) => els.map((e) => e.getAttribute("data-widget")));
  check("옆 칸 위젯 순서", order.join() === "search,village-search,categories,recent,popular,comments,neighbors,tags,visitors", order.join());
  const ownRecent = await widgetText(page, "recent");
  check("주인 최근 글: 비공개 글도 (🔒)", ownRecent.includes(`🔒 비밀 ${KEY} 일기`), ownRecent.slice(0, 80));
  const popularTitles = await sidebar(page).locator('[data-widget="popular"] li').allInnerTexts();
  check("주인 인기 글: 조회수 순 (비공개 500 → 99 → 18)", popularTitles[0].includes("비밀") && popularTitles[1].includes("인기 많은 글") && popularTitles[2].includes("보통 글 6"), popularTitles.join(" | ").replace(/\n/g, " "));
  const ownComments = await widgetText(page, "comments");
  check("주인 최근 댓글: 댓글·답글·비공개 글 댓글", ownComments.includes("공개 글에 단 댓글") && ownComments.includes("↳ 주인의 답글") && ownComments.includes("비밀 글 메모"), ownComments.slice(0, 120));
  const commentHref = await sidebar(page).locator('[data-widget="comments"] a', { hasText: "공개 글에 단 댓글" }).getAttribute("href");
  check("최근 댓글 → 그 글의 댓글 자리", commentHref === `/@${owner.slug}/${ids.hit}#comment-${c1}`, commentHref);
  const ownTags = await widgetText(page, "tags");
  check("주인 태그: 글 수와 비공개 글 태그", ownTags.includes(`#${TAG} 2`) && ownTags.includes(`#${SECRET_TAG} 1`), ownTags);
  await page.screenshot({ path: `${outDir}/blog-owner-1280.png`, fullPage: true });

  // 블로그 안 검색 (주인: 비공개 포함)
  const find = sidebar(page).getByRole("search", { name: "블로그 내 검색" });
  await find.getByLabel("이 블로그에서 찾을 말").fill(KEY);
  await find.getByRole("button", { name: "찾기" }).click();
  await page.waitForURL(/\?s=/);
  await page.locator("[data-list-heading]").filter({ hasText: "블로그 검색" }).waitFor();
  const ownFound = await page.locator('section[aria-label="글 목록"] article h3').allInnerTexts();
  check("주인 블로그 검색: 제목·본문 일치, 비공개 글도", ownFound.length === 2 && ownFound.includes(`비밀 ${KEY} 일기`) && ownFound.includes("인기 많은 글"), ownFound.join(" | "));
  check("블로그 검색 제목 `🔍 '검색어' 블로그 검색 2개`", (await page.locator("[data-list-heading]").innerText()).replace(/\s+/g, " ") === `🔍 '${KEY}' 블로그 검색 2개`);
  await page.goto(`${base}?s=%25`);
  check("블로그 검색 `%`는 글자 그대로 (0개)", (await page.locator('section[aria-label="글 목록"] article').count()) === 0 && (await page.getByText("이 블로그에서 찾은 글이 없어요").isVisible()));
  await page.goto(`${base}?s=${encodeURIComponent("  ")}`);
  check("블로그 검색 공백만 → `찾을 말을 적어 주세요`", await page.getByText("찾을 말을 적어 주세요").isVisible());

  // 글 관리: 공개·비공개 모두, 거르기, 수정·삭제
  await page.goto(`${BASE}/settings/posts`);
  const total = Number((await page.locator("[data-manage-total]").innerText()).replace(/[^0-9]/g, ""));
  const dbTotal = (await one("SELECT count(*)::int AS n FROM posts WHERE blog_id = $1", [blogId])).n;
  check("글 관리: 내 글 수 = 공개 + 비공개", total === dbTotal, `${total} / ${dbTotal}`);
  await page.getByRole("navigation", { name: "공개 범위" }).getByRole("link", { name: "🔒 비공개" }).click();
  await page.waitForURL(/vis=private/);
  const privRows = await page.locator("[data-manage-post]").allInnerTexts();
  check("글 관리: 비공개만 거르기", privRows.length === 1 && privRows[0].includes(`비밀 ${KEY} 일기`), privRows.join(" | ").replace(/\n/g, " "));
  check("글 관리: [수정] → /write/{번호}", (await page.locator(`[data-manage-post="${ids.secret}"]`).getByRole("link", { name: "수정" }).getAttribute("href")) === `/write/${ids.secret}`);
  const del = await post("지울 글", "x", "public", 0, 300);
  await page.goto(`${BASE}/settings/posts?s=${encodeURIComponent("지울 글")}`);
  page.once("dialog", (d) => d.accept());
  await page.locator(`[data-manage-post="${del}"]`).getByRole("button", { name: "삭제" }).click();
  await page.waitForURL((u) => u.pathname === "/settings/posts" && u.search === "", { timeout: 10000 }).catch(() => {});
  check("글 관리에서 삭제 → 글 지워지고 글 관리에 머묾", !(await one("SELECT 1 AS x FROM posts WHERE id = $1", [del])) && new URL(page.url()).pathname === "/settings/posts", page.url());
  await page.goto(`${BASE}/settings/posts`);
  await page.screenshot({ path: `${outDir}/manage-posts-1280.png`, fullPage: true });

  // 다른 회원: 도구 막대 없음, 비공개 글·태그·댓글 없음
  const vp = vis.page;
  await vp.goto(base);
  check("다른 회원: 주인 도구 막대 없음", (await vp.locator("[data-owner-toolbar]").count()) === 0);
  check("다른 회원: 마을 검색 없음, 블로그 검색 있음", (await vp.getByRole("search", { name: "마을 검색" }).count()) === 0 && (await vp.getByRole("search", { name: "블로그 내 검색" }).count()) === 1);
  const vRecent = await widgetText(vp, "recent");
  const vPopular = await widgetText(vp, "popular");
  const vComments = await widgetText(vp, "comments");
  const vTags = await widgetText(vp, "tags");
  check("다른 회원 최근 글·인기 글에 비공개 글 없음", !vRecent.includes("비밀") && !vPopular.includes("비밀") && vPopular.includes("인기 많은 글"), `${vRecent.slice(0, 60)} / ${vPopular.slice(0, 60)}`);
  check("다른 회원 최근 댓글에 비공개 글 댓글 없음", vComments.includes("공개 글에 단 댓글") && !vComments.includes("비밀 글 메모"), vComments.slice(0, 120));
  check("다른 회원 태그에 비공개 글만의 태그 없음", vTags.includes(`#${TAG} 2`) && !vTags.includes(SECRET_TAG), vTags);
  // 방문자 위젯이 블로그 홈의 방문 숫자 한 곳 (프로필 카드는 없앰, 2026-10-11). 기록은 한 번
  await vp.waitForFunction(() => document.querySelector('[data-visit="오늘"]')?.textContent !== "0", null, { timeout: 8000 }).catch(() => {});
  const widgetToday = Number(await vp.locator('[data-visit="오늘"]').innerText());
  const dbToday = (await one("SELECT count(*)::int AS n FROM blog_visits WHERE blog_id = $1 AND date = $2", [blogId, TODAY])).n;
  check("방문자 위젯 오늘 = DB, 프로필 카드 없음", widgetToday === dbToday && dbToday >= 1 && (await vp.locator("[data-profile-card]").count()) === 0, `${widgetToday}/${dbToday}`);
  await vp.screenshot({ path: `${outDir}/blog-visitor-1280.png`, fullPage: true });
  await vp.goto(`${base}?s=${encodeURIComponent(KEY)}`);
  const vFound = await vp.locator('section[aria-label="글 목록"] article h3').allInnerTexts();
  check("다른 회원 블로그 검색: 공개 글만 (비공개 제목 일치 글 없음)", vFound.length === 1 && vFound[0] === "인기 많은 글", vFound.join(" | "));
  await vp.goto(`${base}?tag=${encodeURIComponent(TAG)}`);
  const tagged = await vp.locator('section[aria-label="글 목록"] article h3').allInnerTexts();
  check("태그 누르면 이 블로그의 그 태그 글", tagged.length === 2 && tagged.includes("인기 많은 글") && tagged.includes("보통 글 1"), tagged.join(" | "));
  await vp.goto(`${base}?tag=${encodeURIComponent(SECRET_TAG)}`);
  check("비공개 글만의 태그 주소 → 0개", (await vp.locator('section[aria-label="글 목록"] article').count()) === 0);
  await vp.goto(`${BASE}/settings/posts`);
  check("다른 회원 /settings/posts → 자기 글 관리 (남의 글 없음)", !(await vp.locator("main").innerText()).includes("비밀"));

  // 방문자(로그인 안 함): 비공개 글 검색 안 됨, 글 관리 → 첫 화면
  const g = await fresh();
  await g.page.goto(`${base}?s=${encodeURIComponent("비밀")}`);
  check("방문자 블로그 검색: 비공개 글 없음", (await g.page.locator('section[aria-label="글 목록"] article').count()) === 0);
  await g.page.goto(`${BASE}/settings/posts`);
  check("방문자 /settings/posts → /", new URL(g.page.url()).pathname === "/", g.page.url());
  await g.ctx.close();

  // 주인 375px: 가로 스크롤 없음, 도구 막대가 위, 위젯은 글 목록 아래로 쌓임
  // 휴대폰 창 시험은 오늘 연 기록(쿠키)을 빼고 들어간다
  const ownState = await own.ctx.storageState();
  const m = await fresh(phone, { ...ownState, cookies: ownState.cookies.filter((c) => c.name !== "bv_board_seen") });
  await m.page.goto(base);
  const overflow = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("375px 블로그 홈 가로 스크롤 없음", overflow <= 0, `${overflow}px`);
  const mBar = await m.page.locator("[data-owner-toolbar]").boundingBox();
  const mList = await m.page.locator('section[aria-label="글 목록"]').boundingBox();
  const mSide = await sidebar(m.page).boundingBox();
  check("375px 도구 막대 → 글 목록 → 위젯 차례로", mBar.y < mList.y && mList.y + mList.height <= mSide.y + 1 && Math.abs(mSide.width - mList.width) < 2, `${Math.round(mBar.y)} / ${Math.round(mList.y)} / ${Math.round(mSide.y)}`);
  const small = await m.page.locator("[data-owner-toolbar] a").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  check("375px 도구 버튼 모두 44px 이상", small === 0, String(small));
  await m.page.screenshot({ path: `${outDir}/blog-owner-375.png`, fullPage: true });
  await m.ctx.close();
}

const errors = allErrors.flat();
check("콘솔 오류 없음", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("✅")).length}/${results.length} 통과`);
await browser.close();
await db.end();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
