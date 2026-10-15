// E2E 묶음 실행기: 시험 파일을 차례로 돌리고, 걸린 시간·결과를 표로 남긴다 (테스트 전략 docs/03-test-strategy.md)
// 사용: 서버를 띄운 상태에서
//   node scripts/e2e-run.mjs ci            CI 묶음 (PR마다)
//   node scripts/e2e-run.mjs nightly       매일 밤 묶음 (e2e/suites.json의 nightly)
//   node scripts/e2e-run.mjs shop town     파일 이름을 바로 줘도 된다
// 하나가 실패해도 나머지는 끝까지 돌고, 하나라도 실패하면 종료 코드 1.
// GitHub Actions에서는 결과 표를 실행 화면 요약(GITHUB_STEP_SUMMARY)에 붙인다.
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const suites = JSON.parse(readFileSync(new URL("../e2e/suites.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(`사용: node scripts/e2e-run.mjs <${Object.keys(suites).filter((k) => !k.startsWith("_")).join("|")}|파일 이름...>`);
  process.exit(2);
}
const names = args.flatMap((a) => suites[a] ?? [a]);
const shots = process.env.E2E_SHOTS ?? "e2e-shots";
mkdirSync(shots, { recursive: true });
// 시험 하나가 이보다 오래 걸리면 멈춘 것으로 보고 끊는다 (기본 10분)
const limitMs = Number(process.env.E2E_TIMEOUT_MS ?? 600_000);
const gh = !!process.env.GITHUB_ACTIONS;

function run(name) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    if (gh) console.log(`::group::e2e/${name}.mjs`);
    else console.log(`\n▶ e2e/${name}.mjs`);
    const child = spawn(process.execPath, [`e2e/${name}.mjs`, shots], { stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    const keep = (chunk) => {
      process.stdout.write(chunk);
      tail = (tail + chunk).slice(-4000);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, limitMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (gh) console.log("::endgroup::");
      const sec = Math.round((Date.now() - t0) / 1000);
      // 시험들은 확인 결과를 ✅/❌ 줄로 찍는다. ❌ 줄이 있으면 종료 코드가 0이어도 실패로 본다
      const fails = tail.split("\n").filter((l) => l.startsWith("❌"));
      const ok = code === 0 && !timedOut && fails.length === 0;
      // 던져진 오류는 "locator.click: Timeout 30000ms exceeded." 같은 첫 오류 줄을 이유로 쓴다
      const thrown = tail.split("\n").find((l) => /^\w[\w.]*: |Error\b/.test(l) && !l.startsWith("Node.js"));
      const why = timedOut ? `${Math.round(limitMs / 60000)}분 넘게 걸려 끊음` : fails[0]?.slice(2, 120) ?? (code === 0 ? "" : thrown?.slice(0, 120) ?? `종료 코드 ${code}`);
      if (!ok && gh) console.log(`::error title=e2e/${name}.mjs::${why}`);
      resolve({ name, ok, sec, why });
    });
  });
}

const results = [];
for (const name of names) results.push(await run(name));

const failed = results.filter((r) => !r.ok);
const total = results.reduce((s, r) => s + r.sec, 0);
const table = [
  `### E2E ${args.join(" ")}: ${results.length - failed.length}/${results.length} 통과 (${Math.floor(total / 60)}분 ${total % 60}초)`,
  "",
  "| 시험 | 결과 | 시간 | 실패 이유 |",
  "|---|---|---|---|",
  ...results.map((r) => `| \`e2e/${r.name}.mjs\` | ${r.ok ? "✅" : "❌"} | ${r.sec}초 | ${(r.why ?? "").replaceAll("|", "\\|")} |`),
  "",
].join("\n");
console.log(`\n${table}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + "\n");
writeFileSync(`${shots}/e2e-summary.md`, table);
process.exit(failed.length ? 1 : 0);
