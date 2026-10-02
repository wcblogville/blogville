// 아이템 카탈로그 기본 데이터. 여러 번 실행해도 안전하다 (code 기준으로 덮어쓰기).
// 실행: npm run db:seed
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { items } from "../src/db/schema";

config({ path: ".env.local" });

type NewItem = typeof items.$inferInsert;

const ITEMS: NewItem[] = [
  // 가입할 때 고르는 기본 캐릭터 (is_starter): 남자·여자 중 하나를 골라 받는다
  { code: "char_boy", type: "character", name: "남자 주민", description: "마을에 막 이사 온 남자 주민", price: 0, requiredLevel: 1, isStarter: true, assetKey: "char.boy" },
  { code: "char_girl", type: "character", name: "여자 주민", description: "마을에 막 이사 온 여자 주민", price: 0, requiredLevel: 1, isStarter: true, assetKey: "char.girl" },

  // 상점 캐릭터 (모험가·고양이·강아지는 원래 기본 캐릭터였다. 이미 가진 회원은 그대로 갖고 있다)
  { code: "char_human", type: "character", name: "모험가", description: "어디든 떠나는 씩씩한 모험가", price: 60, requiredLevel: 1, isStarter: false, assetKey: "char.human" },
  { code: "char_cat", type: "character", name: "고양이", description: "호기심 많은 고양이", price: 80, requiredLevel: 1, isStarter: false, assetKey: "char.cat" },
  { code: "char_dog", type: "character", name: "강아지", description: "사람을 좋아하는 강아지", price: 80, requiredLevel: 1, isStarter: false, assetKey: "char.dog" },
  { code: "char_rabbit", type: "character", name: "토끼", description: "글 쓰는 속도가 빠른 토끼", price: 100, requiredLevel: 2, isStarter: false, assetKey: "char.rabbit" },
  { code: "char_fox", type: "character", name: "여우", description: "꾀가 많은 여우", price: 150, requiredLevel: 2, isStarter: false, assetKey: "char.fox" },
  { code: "char_panda", type: "character", name: "판다", description: "느긋하게 꾸준히 쓰는 판다", price: 250, requiredLevel: 3, isStarter: false, assetKey: "char.panda" },
  { code: "char_robot", type: "character", name: "로봇", description: "AI를 공부하는 로봇", price: 400, requiredLevel: 4, isStarter: false, assetKey: "char.robot" },
  { code: "char_dragon", type: "character", name: "드래곤", description: "마을의 전설", price: 800, requiredLevel: 6, isStarter: false, assetKey: "char.dragon" },
  { code: "char_unicorn", type: "character", name: "유니콘", description: "꾸준함의 상징", price: 1200, requiredLevel: 8, isStarter: false, assetKey: "char.unicorn" },

  // 배경 (초원은 모두에게 기본 지급)
  { code: "bg_meadow", type: "background", name: "초원", description: "모든 이야기가 시작되는 곳", price: 0, requiredLevel: 1, isStarter: true, assetKey: "bg.meadow" },
  { code: "bg_beach", type: "background", name: "바닷가", description: "파도 소리가 들리는 해변", price: 120, requiredLevel: 1, isStarter: false, assetKey: "bg.beach" },
  { code: "bg_snow", type: "background", name: "눈 마을", description: "조용히 눈이 쌓이는 마을", price: 200, requiredLevel: 2, isStarter: false, assetKey: "bg.snow" },
  { code: "bg_sakura", type: "background", name: "벚꽃길", description: "봄바람이 부는 벚꽃길", price: 300, requiredLevel: 3, isStarter: false, assetKey: "bg.sakura" },
  { code: "bg_night", type: "background", name: "밤의 도시", description: "불빛이 반짝이는 밤", price: 450, requiredLevel: 4, isStarter: false, assetKey: "bg.night" },
  { code: "bg_space", type: "background", name: "우주", description: "끝없이 펼쳐진 우주", price: 900, requiredLevel: 6, isStarter: false, assetKey: "bg.space" },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    for (const item of ITEMS) {
      await db
        .insert(items)
        .values(item)
        .onConflictDoUpdate({
          target: items.code,
          set: {
            type: item.type,
            name: item.name,
            description: item.description,
            price: item.price,
            requiredLevel: item.requiredLevel,
            isStarter: item.isStarter,
            assetKey: item.assetKey,
          },
        });
    }
    const rows = await db.execute(sql`SELECT type, COUNT(*)::int AS n FROM items GROUP BY type ORDER BY type`);
    console.log("✔ 아이템 시드 완료", rows.rows);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
