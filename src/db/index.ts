import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// 개발 중 파일이 바뀔 때마다 연결 풀이 새로 생기지 않도록 전역에 보관한다
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

// 쉬고 있는 연결을 DB 서버가 끊으면 풀이 "error"를 낸다. 받는 곳이 없으면 Node가 그대로 꺼진다
// (2026-10-13 배포 사이에 앱이 꺼져 502). 끊긴 연결은 풀이 버리고 다음 요청 때 새로 연결한다
if (pool.listenerCount("error") === 0) {
  pool.on("error", (err) => console.error("DB 연결이 끊겼어요 (다음 요청 때 다시 연결해요):", err.message));
}

export const db = drizzle(pool, { schema });
export type DB = typeof db;
