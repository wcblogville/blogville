// 개발용: 회원과 글 데이터를 모두 지운다 (아이템 카탈로그는 남긴다)
// 실행: npm run db:reset
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

if (process.env.NODE_ENV === "production" || !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
  console.error("로컬 DB에서만 실행할 수 있어요.");
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("TRUNCATE users, tags RESTART IDENTITY CASCADE");
  // 로그인 실패 기록은 users와 FK가 없어 CASCADE로 비워지지 않는다 (data-model 2.4).
  // 마이그레이션(0010) 전에 초기화할 수도 있으므로 표가 있을 때만 비운다
  const { rows } = await pool.query<{ exists: boolean }>("SELECT to_regclass('public.login_attempts') IS NOT NULL AS exists");
  if (rows[0]?.exists) await pool.query("TRUNCATE login_attempts");
  console.log("✔ 회원·글·로그인 실패 기록을 비웠어요 (관리자 계정도 지워졌으니 npm run admin:create 를 다시 실행하세요)");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
