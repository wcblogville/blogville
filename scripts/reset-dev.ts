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
  console.log("✔ 회원·글 데이터를 비웠어요");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
