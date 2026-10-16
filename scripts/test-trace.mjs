// 요구사항 ↔ 테스트 연결표 (추적 매트릭스): docs/01-requirements.md 요약 표의 ID마다 어느 시험이 확인하는지 찾는다
// 시험 파일(e2e/*.mjs, scripts/test-*.ts) 안에 요구사항 ID(AUTH-07 등)가 적혀 있으면 "그 요구사항을 확인한다"로 본다.
// 사용: npm run test:trace            → docs/04-test-trace.md를 새로 쓴다
//       npm run test:trace -- --check → 표가 코드와 다르면 실패 (CI)
import { readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const OUT = "docs/04-test-trace.md";
const STATUS = { "✅": "구현됨", "🚧": "진행 중", "⬜": "미구현", "❌": "제외" };

// 1. 요구사항: 요약 표의 줄 `| ID | (분류 |) 요구사항 | 우선 | 상태 | ... |` (우선 칸은 M·S·C·W 한 글자)
const reqs = [];
for (const line of read("docs/01-requirements.md").split("\n")) {
  const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
  const id = cells[0]?.match(/^([A-Z]{2,6}-\d{2})$/)?.[1];
  const p = cells.findIndex((c, i) => i > 1 && /^[MSCW]$/.test(c));
  if (!id || id.startsWith("XXX") || p < 0 || reqs.some((r) => r.id === id)) continue;
  const status = [...(cells[p + 1] ?? "")].find((c) => STATUS[c]) ?? "⬜";
  // 요구사항 문장은 앞부분만 짧게 (굵은 글씨·괄호 설명 빼고)
  const title = cells[p - 1].replaceAll("**", "").replaceAll("`", "").replace(/\s*\(.*$/, "").split(/\. |:|→/)[0].trim().slice(0, 60);
  reqs.push({ id, title, prio: cells[p], status });
}

// 2. 시험 파일과 그 안에 적힌 ID
const suites = JSON.parse(read("e2e/suites.json"));
const ciSet = new Set(suites.ci);
const nightlySet = new Set(suites.nightly);
const files = [
  ...readdirSync(new URL("scripts/", root))
    .filter((f) => /^test-.+\.ts$/.test(f))
    .map((f) => ({ path: `scripts/${f}`, kind: "단위", when: "PR" })),
  ...readdirSync(new URL("e2e/", root))
    .filter((f) => f.endsWith(".mjs") && !f.startsWith("_") && f !== "helpers.mjs")
    .map((f) => {
      const name = f.slice(0, -4);
      return { path: `e2e/${f}`, kind: "E2E", when: ciSet.has(name) ? "PR" : nightlySet.has(name) ? "매일 밤" : "손으로" };
    }),
];
const byReq = new Map(reqs.map((r) => [r.id, []]));
for (const f of files) {
  const ids = new Set(read(f.path).match(/\b[A-Z]{2,6}-\d{2}\b/g) ?? []);
  for (const id of ids) byReq.get(id)?.push(f);
}

// 3. 표 만들기
const active = reqs.filter((r) => r.status === "✅" || r.status === "🚧");
const covered = active.filter((r) => byReq.get(r.id).length > 0);
const inPr = active.filter((r) => byReq.get(r.id).some((f) => f.when === "PR"));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const label = (f) => `\`${f.path.replace(/^(e2e|scripts)\//, "")}\`${f.when === "PR" ? "" : f.when === "매일 밤" ? " 🌙" : " ✋"}`;
const groups = [...new Set(reqs.map((r) => r.id.split("-")[0]))];

const md = [
  "# 요구사항 ↔ 테스트 연결표",
  "",
  "> 자동으로 만든 파일이다. 손으로 고치지 말고 `npm run test:trace`로 다시 만든다.",
  "> 시험 파일 안에 요구사항 ID(예: `AUTH-07`)를 주석으로 적으면 여기에 잡힌다. 전략은 [03-test-strategy.md](03-test-strategy.md).",
  "",
  "## 요약",
  "",
  `- 구현된 요구사항(✅·🚧) **${active.length}개** 중 시험이 있는 것 **${covered.length}개 (${pct(covered.length, active.length)}%)**`,
  `- 그중 PR마다 자동으로 확인하는 것 **${inPr.length}개 (${pct(inPr.length, active.length)}%)**`,
  `- 시험 파일: 단위 ${files.filter((f) => f.kind === "단위").length}개, E2E ${files.filter((f) => f.kind === "E2E").length}개 (PR ${files.filter((f) => f.kind === "E2E" && f.when === "PR").length} · 매일 밤 ${files.filter((f) => f.when === "매일 밤").length} · 손으로 ${files.filter((f) => f.when === "손으로").length})`,
  "",
  "표시: 이름만 = PR마다(단위 테스트·CI E2E), 🌙 = 매일 밤 전체 E2E, ✋ = 손으로 돌리는 시험",
  "",
  "## 시험이 없는 구현된 요구사항",
  "",
  ...(active.length === covered.length ? ["없음"] : active.filter((r) => !byReq.get(r.id).length).map((r) => `- **${r.id}** ${r.title} (${r.prio})`)),
  "",
  ...groups.flatMap((g) => [
    `## ${g}`,
    "",
    "| ID | 요구사항 | 우선 | 상태 | 확인하는 시험 |",
    "|---|---|---|---|---|",
    ...reqs
      .filter((r) => r.id.startsWith(`${g}-`))
      .map((r) => {
        const fs = byReq.get(r.id);
        const unit = fs.filter((f) => f.kind === "단위").map(label);
        const e2e = fs.filter((f) => f.kind === "E2E").map(label);
        const cell = [...unit, ...e2e].join(", ") || (r.status === "✅" || r.status === "🚧" ? "**없음**" : "-");
        return `| ${r.id} | ${r.title.replaceAll("|", "\\|")} | ${r.prio} | ${r.status} | ${cell} |`;
      }),
    "",
  ]),
].join("\n");

const summary = `요구사항 ${active.length}개 중 시험 있음 ${covered.length}개 (${pct(covered.length, active.length)}%), PR마다 확인 ${inPr.length}개 (${pct(inPr.length, active.length)}%)`;
if (process.argv.includes("--check")) {
  let old = "";
  try {
    old = read(OUT);
  } catch {}
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 요구사항 ↔ 테스트\n\n${summary}\n`);
  if (old !== md) {
    console.error(`❌ ${OUT}가 지금 코드와 다릅니다. npm run test:trace 로 다시 만들어 함께 올려 주세요.`);
    process.exit(1);
  }
  console.log(`✅ ${OUT} 최신 (${summary})`);
} else {
  writeFileSync(new URL(OUT, root), md);
  console.log(`${OUT} 썼습니다: ${summary}`);
}
