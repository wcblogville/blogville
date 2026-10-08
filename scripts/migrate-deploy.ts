// 배포용 마이그레이션: drizzle/ 폴더의 SQL을 원하는 스키마(DB_SCHEMA)에 적용한다.
// 크로우풋이 발급한 DB는 public이 아니라 전용 스키마(cf_...)만 쓸 수 있어서
// `drizzle-kit migrate` 대신 이 스크립트를 쓴다. 기록 표는 drizzle과 같은 모양(__drizzle_migrations)이다.
//   DATABASE_URL=postgres://... DB_SCHEMA=cf_u28_d1 npm run db:migrate:deploy
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

const schema = process.env.DB_SCHEMA || "public";
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`DB_SCHEMA 형식이 이상해요: ${schema}`);

const dir = path.join(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(path.join(dir, "meta", "_journal.json"), "utf8")) as {
  entries: { idx: number; tag: string; when: number }[];
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS "${schema}"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
    );
    const done = await client.query<{ created_at: string }>(
      `SELECT created_at FROM "${schema}"."__drizzle_migrations"`,
    );
    const applied = new Set(done.rows.map((r) => Number(r.created_at)));

    let count = 0;
    for (const entry of journal.entries) {
      if (applied.has(entry.when)) continue;
      const raw = readFileSync(path.join(dir, `${entry.tag}.sql`), "utf8");
      const sql = schema === "public" ? raw : raw.replaceAll('"public".', `"${schema}".`);
      // 마이그레이션마다 따로 트랜잭션: 앞에서 더한 enum 값을 뒤 마이그레이션이 쓸 수 있게
      await client.query("BEGIN");
      try {
        for (const stmt of sql.split("--> statement-breakpoint")) {
          if (stmt.trim()) await client.query(stmt);
        }
        await client.query(
          `INSERT INTO "${schema}"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
          [createHash("sha256").update(raw).digest("hex"), entry.when],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`${entry.tag} 적용 실패: ${(err as Error).message}`);
      }
      console.log(`✓ ${entry.tag}`);
      count++;
    }
    console.log(count ? `마이그레이션 ${count}개 적용 (스키마 ${schema})` : `새 마이그레이션 없음 (스키마 ${schema})`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
