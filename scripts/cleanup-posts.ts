// 글 데이터 정리 (POST-07·POST-09 / FR-059, SC-011, POST-06 조회 기록 보관):
// 하루 넘게 어느 글에도 붙지 않은 첨부, 행 없는 저장소 파일, 어제보다 오래된 조회 기록을 지운다.
// 실행: npm run posts:cleanup  (세기만: npm run posts:cleanup -- --dry-run). 배포 환경에서는 하루 1번 돌린다
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // DB·저장소 모듈이 불러올 때 환경 변수를 읽으므로 .env.local을 읽은 뒤에 불러온다
  const { cleanupPostData } = await import("../src/server/attachments");
  const r = await cleanupPostData({ dryRun });
  const verb = dryRun ? "지울" : "지운";
  console.log(`${dryRun ? "(세기만) " : ""}${verb} 첨부: ${r.attachments}개`);
  console.log(`${verb} 주인 없는 파일: ${r.files}개`);
  console.log(`${verb} 조회 기록: ${r.views}개`);
  process.exit(0);
}

main().catch((err) => {
  console.error("정리하지 못했어요", err);
  process.exit(1);
});
