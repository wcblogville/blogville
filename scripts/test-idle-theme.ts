// 가만히 동작·마을 테마·이웃 말풍선 테스트 (사용자 요청 2026-10-12)
// 실행: npm run test:idle
import { BACK_PARTS, partRows } from "../src/lib/art/avatar";
import { CHARACTER_KEYS } from "../src/lib/art/characters";
import { IDLE_COLS, IDLE_FRAME, IDLE_MOTIONS, idleDuration, idleFrame, idleFrameAt, idleFrameIndex, idleOriginY, idleSheetSvg, pickIdleMotion } from "../src/lib/art/idle";
import { PALETTE, PIXEL } from "../src/lib/art/pixel";
import { gradeRgb, snowCapPixels, TOWN_THEME_KEYS, TOWN_THEMES, townTheme, townThemeOf } from "../src/lib/art/town-theme";
import { walkFrame } from "../src/lib/art/walk";
import { bakeGround, GROUND_SIZE } from "../src/components/town/ground";
import { GREETING_MAX, normalizeGreeting, sentencesOf, talkLines, TALK_LINES } from "../src/lib/town-talk";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const SHADOW = PALETTE[":"];

// ===== 가만히 동작 =====
{
  expect("동작이 5가지 넘게", IDLE_MOTIONS.length >= 5, true);
  expect("동작 key가 겹치지 않음", new Set(IDLE_MOTIONS.map((m) => m.key)).size, IDLE_MOTIONS.length);
  expect("동작마다 그림 칸 수가 그림판 칸(IDLE_COLS)에 들어감", IDLE_MOTIONS.filter((m) => m.frames + 1 > IDLE_COLS).map((m) => m.key), []);
  expect("재생 순서의 칸은 0~frames 안", IDLE_MOTIONS.filter((m) => m.sequence.some((s) => s.frame < 0 || s.frame > m.frames || s.ms <= 0)).map((m) => m.key), []);
  expect("모든 그림 칸이 재생 순서에 나옴", IDLE_MOTIONS.filter((m) => Array.from({ length: m.frames }, (_, i) => i + 1).some((f) => !m.sequence.some((s) => s.frame === f))).map((m) => m.key), []);
  expect("동작 길이 0.8~5초", IDLE_MOTIONS.filter((m) => idleDuration(m) < 800 || idleDuration(m) > 5000).map((m) => `${m.key}:${idleDuration(m)}`), []);

  const looks: [string, string[]][] = [
    ...CHARACTER_KEYS().map((k): [string, string[]] => [k, []]),
    ["char.girl", ["hair.long", "haircolor.pink", "outfit.hanbok", "hat.crown", "acc.glasses"]],
    ["char.cat", ["outfit.wizard", "hat.wizard", "acc.scarf"]],
  ];
  const bad: string[] = [];
  const unchanged: string[] = [];
  const shadowMoved: string[] = [];
  for (const [k, o] of looks) {
    const stand = idleFrame(k, o, "wave", 0);
    const shadowRow = (g: (string | null)[][]) => g[IDLE_FRAME.h - 1].map((c) => c === SHADOW);
    for (const m of IDLE_MOTIONS)
      for (let f = 0; f <= m.frames; f++) {
        const g = idleFrame(k, o, m.key, f);
        if (g.length !== IDLE_FRAME.h || g.some((r) => r.length !== IDLE_FRAME.w)) bad.push(`${k}:${m.key}:${f}`);
        if (f > 0 && same(g, stand)) unchanged.push(`${k}:${m.key}:${f}`);
        if (!same(shadowRow(g), shadowRow(stand))) shadowMoved.push(`${k}:${m.key}:${f}`);
      }
  }
  expect("모든 캐릭터·동작·칸이 24×32", bad, []);
  expect("동작 칸은 서 있기와 다름", unchanged, []);
  expect("그림자(맨 아래 줄)는 움직이지 않음", shadowMoved, []);
  // 서 있기 칸 = 걷기 그림판의 앞모습 서 있기를 아래 가운데에 놓은 것
  const walk = walkFrame("char.boy", [], "down", 0);
  const stand = idleFrame("char.boy", [], "jump", 0);
  expect("서 있기 칸 = 걷기 서 있기 (아래 24줄, 가운데 16칸)", same(stand.slice(IDLE_FRAME.h - 24).map((r) => r.slice(4, 20)), walk), true);
  expect("점프 꼭대기는 몸이 위로 (맨 위 줄에 그림이 있음)", stand.slice(0, 3).flat().some(Boolean) === false && idleFrame("char.boy", [], "jump", 3).slice(0, 3).flat().some(Boolean), true);

  const svg = idleSheetSvg("char.boy", [], PIXEL);
  expect("그림판 크기 = 24×32 × (칸 수 × 동작 수) × PIXEL", /width="(\d+)" height="(\d+)"/.exec(svg)?.slice(1).map(Number), [24 * IDLE_COLS * PIXEL, 32 * IDLE_MOTIONS.length * PIXEL]);
  expect("프레임 번호 = 줄 × 칸 수 + 칸", [idleFrameIndex("wave", 0), idleFrameIndex("jump", 2), idleFrameIndex(IDLE_MOTIONS[IDLE_MOTIONS.length - 1].key, 1)], [0, IDLE_COLS + 2, (IDLE_MOTIONS.length - 1) * IDLE_COLS + 1]);
  const wave = IDLE_MOTIONS[0];
  expect("시간 → 칸: 처음·끝", [idleFrameAt(wave, 0), idleFrameAt(wave, idleDuration(wave) - 1), idleFrameAt(wave, idleDuration(wave))], [wave.sequence[0].frame, wave.sequence[wave.sequence.length - 1].frame, null]);
  expect("무작위로 고르되 바로 앞 동작은 피함", Array.from({ length: 20 }, (_, i) => pickIdleMotion(i / 20, "wave").key).includes("wave"), false);
  expect("발 위치가 같은 원점: 걷기 0.94 → 가만히", Math.round(idleOriginY(0.94) * IDLE_FRAME.h * 100) / 100, Math.round((IDLE_FRAME.h - (1 - 0.94) * 24) * 100) / 100);
}

// ===== 마을 테마 =====
{
  expect("배경 → 테마", ["bg.meadow", "bg.beach", "bg.snow", "bg.sakura", "bg.night", "bg.space"].map(townThemeOf), ["meadow", "beach", "snow", "sakura", "night", "space"]);
  expect("모르는 배경·없음 → 초원", [townThemeOf("bg.mars"), townThemeOf(null), townThemeOf("snow")], ["meadow", "meadow", "meadow"]);
  expect("테마마다 key가 이름과 같음", TOWN_THEME_KEYS.filter((k) => TOWN_THEMES[k].key !== k), []);
  expect("초원은 색 보정·날씨 없음", [TOWN_THEMES.meadow.grade, TOWN_THEMES.meadow.weather, TOWN_THEMES.meadow.snow], [null, null, false]);
  expect("눈 마을은 눈이 쌓이고 눈이 내림", [TOWN_THEMES.snow.snow, TOWN_THEMES.snow.weather], [true, "snow"]);
  expect("잔디 색 4단 × 4색 (모든 테마)", TOWN_THEME_KEYS.filter((k) => [0, 1, 2, 3].some((lv) => TOWN_THEMES[k].grass[lv]?.length !== 4)), []);
  expect("모르는 테마 key → 초원", townTheme("nope").key, "meadow");
  const [r, g, b] = gradeRgb(120, 200, 120, TOWN_THEMES.space.grade);
  expect("우주 테마 보정은 보라빛 (파랑 > 초록 차이가 커짐)", b - g > 120 - 200, true);
  expect("밤 테마 보정은 어둡게", gradeRgb(200, 200, 200, TOWN_THEMES.night.grade).reduce((a, c) => a + c, 0) < 400, true);
  expect("세기 0이면 그대로", gradeRgb(10, 20, 30, TOWN_THEMES.night.grade, 0), [10, 20, 30]);
  void r;

  // 바닥: 테마마다 따로 굽고, 눈 마을 바닥은 초원보다 밝고 푸르다(눈밭)
  const avg = (key: string) => {
    const px = bakeGround(key);
    let s = [0, 0, 0];
    const n = GROUND_SIZE.w * GROUND_SIZE.h;
    for (let o = 0; o < px.length; o += 4) s = [s[0] + px[o], s[1] + px[o + 1], s[2] + px[o + 2]];
    return s.map((v) => Math.round(v / n));
  };
  const [meadow, snow, space, night] = ["meadow", "snow", "space", "night"].map(avg);
  expect("바닥 크기 그대로", bakeGround("snow").length, GROUND_SIZE.w * GROUND_SIZE.h * 4);
  expect("눈 마을 바닥이 초원보다 밝다", snow[0] + snow[1] + snow[2] > meadow[0] + meadow[1] + meadow[2] + 60, true);
  expect("우주 바닥은 보랏빛 (파랑 > 초록)", space[2] > space[1], true);
  expect("밤 바닥은 어둡다", night[0] + night[1] + night[2] < (meadow[0] + meadow[1] + meadow[2]) * 0.6, true);
  expect("같은 테마는 한 번 구운 것을 다시 씀", bakeGround("snow") === bakeGround("snow"), true);

  // 눈 얹기: 3×3 도트 상자(외곽선 칸 하나 + 속) 위에 눈. 맨 윗줄(외곽선)은 그대로, 그 아래 칸이 흰색
  const S = 3;
  const w = 3 * S;
  const h = 4 * S;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = S; y < h; y++) for (let x = 0; x < w; x++) px.set([50, 40, 30, 255], (y * w + x) * 4);
  snowCapPixels(px, w, h, S);
  const at = (cx: number, cy: number) => [...px.slice(((cy * S + 1) * w + cx * S + 1) * 4, ((cy * S + 1) * w + cx * S + 1) * 4 + 3)];
  expect("눈 얹기: 윗면 외곽선은 그대로", at(1, 1), [50, 40, 30]);
  expect("눈 얹기: 바로 아래 칸은 눈", at(1, 2), [255, 255, 255]);
  expect("눈 얹기: 빈 칸은 그대로 투명", px[3], 0);
}

// ===== 옷 뒷모습 (사용자 요청 2026-10-12 "정장같은 옷 입었을때 위로 올라가면 옷이 뒷모습이 보여야하는데") =====
{
  const backs = BACK_PARTS();
  expect("앞 무늬가 있는 아이템은 뒷모습(위로 걷기)이 앞모습과 다름", backs.filter((k) => k.startsWith("outfit.") && same(walkFrame("char.boy", [k], "up", 0).slice(13, 21), walkFrame("char.boy", [k], "down", 0).slice(13, 21))), []);
  expect("뒷모습 줄이 앞모습과 다름 (모든 뒷모습 아이템)", backs.filter((k) => same(partRows(k, "back"), partRows(k, "front"))), []);
  const suitBack = walkFrame("char.boy", ["outfit.suit"], "up", 0).flat();
  const suitFront = walkFrame("char.boy", ["outfit.suit"], "down", 0).flat();
  const tie = PALETTE.N;
  expect("정장: 앞모습엔 넥타이(빨강), 뒷모습엔 없음", [suitFront.includes(tie), suitBack.includes(tie)], [true, false]);
  expect("정장: 뒷모습엔 셔츠 흰색도 없음", suitBack.includes(PALETTE.w), false);
  expect("나비넥타이·목걸이·메달은 뒤에서 안 보임", ["acc.bowtie", "acc.necklace", "acc.medal"].map((k) => partRows(k, "back").length), [0, 0, 0]);
  expect("황금 예복 뒷모습은 빨간 망토", walkFrame("char.boy", ["outfit.royal"], "up", 0)[16].filter((c) => c === PALETTE.N).length >= 6, true);
  expect("모든 뒷모습 그림도 16×24", backs.filter((k) => { const g = walkFrame("char.girl", [k], "up", 0); return g.length !== 24 || g.some((r) => r.length !== 16); }), []);
}

// ===== 이웃 말풍선 =====
{
  expect("한마디 다듬기", [normalizeGreeting("  안녕   하세요 \n"), normalizeGreeting("   "), normalizeGreeting(null), normalizeGreeting("가".repeat(GREETING_MAX + 1))], ["안녕 하세요", null, null, "long"]);
  expect("한마디 60자는 됨", normalizeGreeting("가".repeat(GREETING_MAX)), "가".repeat(GREETING_MAX));
  expect(
    "문장 나누기: 너무 짧은 것·긴 것·주소는 뺀다",
    sentencesOf("오늘은 날씨가 좋았다. 응! 공원에 가서 산책을 했어요!\n자세한 건 https://example.com 에서 보세요. " + "아".repeat(81) + "."),
    ["오늘은 날씨가 좋았다.", "공원에 가서 산책을 했어요!"],
  );
  expect("한마디가 있으면 그것 하나", talkLines(" 반가워요 ", ["글 문장입니다. 또 다른 문장이에요."]), ["반가워요"]);
  expect("없으면 글의 문장들 (겹치지 않게)", talkLines(null, ["첫 번째 문장이에요. 두 번째 문장이에요.", "첫 번째 문장이에요."]), ["첫 번째 문장이에요.", "두 번째 문장이에요."]);
  expect("후보는 최대 TALK_LINES개", talkLines(null, [Array.from({ length: 30 }, (_, i) => `문장 번호 ${i}입니다.`).join(" ")]).length, TALK_LINES);
  expect("글도 없으면 빈 목록", talkLines(null, []), []);
  expect("HTML처럼 보이는 글자도 그대로 글자 (해석하지 않음)", talkLines("<b>굵게</b> 인사", []), ["<b>굵게</b> 인사"]);
}

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n가만히 동작·마을 테마·이웃 말풍선 테스트 모두 통과");
