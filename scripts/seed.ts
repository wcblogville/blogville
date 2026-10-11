// 아이템 카탈로그 기본 데이터. 여러 번 실행해도 안전하다 (code 기준으로 덮어쓰기).
// 실행: npm run db:seed
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { animalSpecies, items } from "../src/db/schema";

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
  // 집 안 가구 (마을 개편 2차). 화분·나무 의자는 가입할 때 모두 받는 기본 가구. 마이그레이션 0026에도 같은 값이 있다
  { code: "fur_plant", type: "furniture", name: "초록 화분", description: "집 안을 싱그럽게 해 주는 화분", price: 0, requiredLevel: 1, isStarter: true, assetKey: "furniture.plant" },
  { code: "fur_chair", type: "furniture", name: "나무 의자", description: "처음 이사 온 날부터 함께한 의자", price: 0, requiredLevel: 1, isStarter: true, assetKey: "furniture.chair" },
  { code: "fur_table", type: "furniture", name: "둥근 탁자", description: "따뜻한 차 한 잔 놓기 좋은 탁자", price: 40, requiredLevel: 1, isStarter: false, assetKey: "furniture.table" },
  { code: "fur_rug", type: "furniture", name: "알록달록 러그", description: "발이 포근해지는 동그란 러그", price: 50, requiredLevel: 1, isStarter: false, assetKey: "furniture.rug" },
  { code: "fur_shelf", type: "furniture", name: "책장", description: "읽은 책과 쓴 글이 쌓이는 책장", price: 80, requiredLevel: 2, isStarter: false, assetKey: "furniture.shelf" },
  { code: "fur_lamp", type: "furniture", name: "스탠드 조명", description: "밤에 글 쓸 때 켜는 조명", price: 60, requiredLevel: 2, isStarter: false, assetKey: "furniture.lamp" },
  { code: "fur_bed", type: "furniture", name: "포근한 침대", description: "푹 자고 일어나면 글이 술술", price: 120, requiredLevel: 3, isStarter: false, assetKey: "furniture.bed" },
  { code: "fur_sofa", type: "furniture", name: "푹신한 소파", description: "이웃이 놀러 오면 앉는 소파", price: 200, requiredLevel: 4, isStarter: false, assetKey: "furniture.sofa" },
  // 광장 장식 (광장 꾸미기, 사용자 요청 2026-10-09): 내 광장의 꾸미기 자리에 놓는다. 자리는 집 단계만큼 4/6/8자리. 그림은 src/lib/art/deco.ts
  { code: "deco_bench", type: "deco", name: "나무 벤치", description: "이웃과 나란히 앉아 쉬어 가는 벤치", price: 30, requiredLevel: 1, isStarter: false, assetKey: "deco.bench" },
  { code: "deco_flowerbed", type: "deco", name: "꽃밭", description: "알록달록 꽃이 핀 나무 화단", price: 40, requiredLevel: 1, isStarter: false, assetKey: "deco.flowerbed" },
  { code: "deco_signpost", type: "deco", name: "이정표", description: "마을 곳곳을 가리키는 나무 이정표", price: 50, requiredLevel: 2, isStarter: false, assetKey: "deco.signpost" },
  { code: "deco_snowman", type: "deco", name: "눈사람", description: "한여름에도 녹지 않는 신기한 눈사람", price: 80, requiredLevel: 3, isStarter: false, assetKey: "deco.snowman" },
  { code: "deco_tent", type: "deco", name: "캠핑 텐트", description: "광장에서 별 보며 하룻밤", price: 120, requiredLevel: 5, isStarter: false, assetKey: "deco.tent" },
  { code: "deco_swing", type: "deco", name: "그네", description: "바람을 가르는 나무 그네", price: 150, requiredLevel: 7, isStarter: false, assetKey: "deco.swing" },
  { code: "deco_statue", type: "deco", name: "곰 동상", description: "하트를 안은 마을의 수호곰", price: 220, requiredLevel: 10, isStarter: false, assetKey: "deco.statue" },
  { code: "deco_windmill", type: "deco", name: "풍차", description: "광장 바람에 빙글빙글 도는 풍차", price: 350, requiredLevel: 15, isStarter: false, assetKey: "deco.windmill" },
  // 아바타 꾸미기 (SHOP-06): 캐릭터 위에 겹쳐 입는 모자·옷·소품. 부위마다 하나
  { code: "hat_straw", type: "avatar", avatarSlot: "hat", name: "밀짚모자", description: "햇살 좋은 날 산책할 때 쓰는 모자", price: 50, requiredLevel: 1, isStarter: false, assetKey: "hat.straw" },
  { code: "hat_ribbon", type: "avatar", avatarSlot: "hat", name: "리본", description: "머리에 다는 커다란 빨간 리본", price: 60, requiredLevel: 1, isStarter: false, assetKey: "hat.ribbon" },
  { code: "hat_beanie", type: "avatar", avatarSlot: "hat", name: "털모자", description: "추운 날에도 따뜻한 방울 털모자", price: 80, requiredLevel: 2, isStarter: false, assetKey: "hat.beanie" },
  { code: "outfit_overalls", type: "avatar", avatarSlot: "outfit", name: "멜빵바지", description: "농장 일도 거뜬한 청 멜빵바지", price: 100, requiredLevel: 1, isStarter: false, assetKey: "outfit.overalls" },
  { code: "outfit_hoodie", type: "avatar", avatarSlot: "outfit", name: "후드티", description: "글 쓸 때 입는 편한 후드티", price: 150, requiredLevel: 2, isStarter: false, assetKey: "outfit.hoodie" },
  { code: "outfit_dress", type: "avatar", avatarSlot: "outfit", name: "원피스", description: "꽃무늬가 들어간 노란 원피스", price: 200, requiredLevel: 3, isStarter: false, assetKey: "outfit.dress" },
  { code: "acc_glasses", type: "avatar", avatarSlot: "accessory", name: "안경", description: "글자가 또렷하게 보이는 동그란 안경", price: 70, requiredLevel: 1, isStarter: false, assetKey: "acc.glasses" },
  { code: "acc_scarf", type: "avatar", avatarSlot: "accessory", name: "목도리", description: "목을 포근하게 감싸는 줄무늬 목도리", price: 120, requiredLevel: 2, isStarter: false, assetKey: "acc.scarf" },
  { code: "acc_bag", type: "avatar", avatarSlot: "accessory", name: "가방", description: "공책과 펜이 들어가는 크로스백", price: 180, requiredLevel: 3, isStarter: false, assetKey: "acc.bag" },
  // 옷가게 (SHOP-08, 사용자 요청 2026-10-11): 새 옷·모자. 위의 모자·옷·소품과 함께 옷가게에서 입어 보고 산다
  { code: "outfit_pajama", type: "avatar", avatarSlot: "outfit", name: "줄무늬 잠옷", description: "늦잠 자고 싶은 날의 하늘색 줄무늬 잠옷", price: 90, requiredLevel: 1, isStarter: false, assetKey: "outfit.pajama" },
  { code: "outfit_chef", type: "avatar", avatarSlot: "outfit", name: "요리사 옷", description: "빨간 스카프를 맨 하얀 요리사 옷", price: 140, requiredLevel: 2, isStarter: false, assetKey: "outfit.chef" },
  { code: "outfit_suit", type: "avatar", avatarSlot: "outfit", name: "정장", description: "중요한 글을 올리는 날 입는 남색 정장", price: 160, requiredLevel: 2, isStarter: false, assetKey: "outfit.suit" },
  { code: "outfit_hanbok", type: "avatar", avatarSlot: "outfit", name: "색동 한복", description: "명절에 입는 노란 저고리와 빨간 치마", price: 220, requiredLevel: 3, isStarter: false, assetKey: "outfit.hanbok" },
  { code: "outfit_wizard", type: "avatar", avatarSlot: "outfit", name: "마법사 로브", description: "금빛 별이 반짝이는 보라 로브", price: 300, requiredLevel: 4, isStarter: false, assetKey: "outfit.wizard" },
  { code: "outfit_knight", type: "avatar", avatarSlot: "outfit", name: "기사 갑옷", description: "마을을 지키는 은빛 갑옷", price: 400, requiredLevel: 5, isStarter: false, assetKey: "outfit.knight" },
  { code: "hat_chef", type: "avatar", avatarSlot: "hat", name: "요리사 모자", description: "높고 하얀 요리사 모자", price: 70, requiredLevel: 2, isStarter: false, assetKey: "hat.chef" },
  { code: "hat_wizard", type: "avatar", avatarSlot: "hat", name: "마법사 모자", description: "별이 달린 보라 고깔모자", price: 120, requiredLevel: 4, isStarter: false, assetKey: "hat.wizard" },
  { code: "hat_crown", type: "avatar", avatarSlot: "hat", name: "금관", description: "빨간 보석이 박힌 반짝이는 금관", price: 500, requiredLevel: 6, isStarter: false, assetKey: "hat.crown" },
  // 미용실 (SHOP-07, 사용자 요청 2026-10-11): 머리 모양·머리 색. 사람 캐릭터만 보인다. 0코인은 미용실에서 고르면 바로 받는다
  { code: "hair_short", type: "avatar", avatarSlot: "hair", name: "짧은 머리", description: "단정하고 깔끔한 짧은 머리", price: 0, requiredLevel: 1, isStarter: false, assetKey: "hair.short" },
  { code: "hair_bob", type: "avatar", avatarSlot: "hair", name: "단발", description: "일자 앞머리 단발", price: 0, requiredLevel: 1, isStarter: false, assetKey: "hair.bob" },
  { code: "hair_spiky", type: "avatar", avatarSlot: "hair", name: "삐죽 머리", description: "하늘로 뻗친 장난꾸러기 머리", price: 40, requiredLevel: 1, isStarter: false, assetKey: "hair.spiky" },
  { code: "hair_pony", type: "avatar", avatarSlot: "hair", name: "포니테일", description: "빨간 끈으로 높이 묶은 꽁지머리", price: 60, requiredLevel: 1, isStarter: false, assetKey: "hair.pony" },
  { code: "hair_long", type: "avatar", avatarSlot: "hair", name: "긴 생머리", description: "어깨 아래로 찰랑이는 긴 머리", price: 80, requiredLevel: 2, isStarter: false, assetKey: "hair.long" },
  { code: "hair_buns", type: "avatar", avatarSlot: "hair", name: "똥머리", description: "양쪽으로 동그랗게 묶은 머리", price: 90, requiredLevel: 2, isStarter: false, assetKey: "hair.buns" },
  { code: "hair_curly", type: "avatar", avatarSlot: "hair", name: "뽀글 파마", description: "몽글몽글 부푼 곱슬 파마", price: 120, requiredLevel: 3, isStarter: false, assetKey: "hair.curly" },
  { code: "haircolor_brown", type: "avatar", avatarSlot: "hair_color", name: "밤색", description: "따뜻한 밤색", price: 0, requiredLevel: 1, isStarter: false, assetKey: "haircolor.brown" },
  { code: "haircolor_black", type: "avatar", avatarSlot: "hair_color", name: "흑발", description: "윤기 나는 검은색", price: 0, requiredLevel: 1, isStarter: false, assetKey: "haircolor.black" },
  { code: "haircolor_blonde", type: "avatar", avatarSlot: "hair_color", name: "금발", description: "햇살 같은 금색", price: 30, requiredLevel: 1, isStarter: false, assetKey: "haircolor.blonde" },
  { code: "haircolor_red", type: "avatar", avatarSlot: "hair_color", name: "빨강 머리", description: "단풍처럼 붉은색", price: 40, requiredLevel: 1, isStarter: false, assetKey: "haircolor.red" },
  { code: "haircolor_pink", type: "avatar", avatarSlot: "hair_color", name: "분홍 머리", description: "벚꽃 같은 분홍색", price: 60, requiredLevel: 1, isStarter: false, assetKey: "haircolor.pink" },
  { code: "haircolor_mint", type: "avatar", avatarSlot: "hair_color", name: "민트 머리", description: "시원한 민트색", price: 60, requiredLevel: 2, isStarter: false, assetKey: "haircolor.mint" },
  { code: "haircolor_lavender", type: "avatar", avatarSlot: "hair_color", name: "보라 머리", description: "몽환적인 연보라색", price: 80, requiredLevel: 2, isStarter: false, assetKey: "haircolor.lavender" },
  { code: "haircolor_silver", type: "avatar", avatarSlot: "hair_color", name: "은발", description: "반짝이는 은빛", price: 100, requiredLevel: 3, isStarter: false, assetKey: "haircolor.silver" },
  // 성장 아이템 (SHOP-01 2026-10-07, TOWN-09): 여러 번 사서 모으고 농장에서 쓴다
  { code: "growth_feed", type: "growth", growthValue: 20, name: "동물 먹이", description: "동물이 조금 자라요 (성장 +20)", price: 20, requiredLevel: 1, isStarter: false, assetKey: "growth.feed" },
  { code: "growth_premium", type: "growth", growthValue: 50, name: "고급 먹이", description: "영양 가득한 먹이 (성장 +50)", price: 60, requiredLevel: 1, isStarter: false, assetKey: "growth.premium" },
  { code: "growth_booster", type: "growth", growthValue: 100, name: "성장 촉진제", description: "쑥쑥 자라는 특별한 물약 (성장 +100)", price: 150, requiredLevel: 3, isStarter: false, assetKey: "growth.booster" },
];

// 동물 농장 동물 종류 (TOWN-09). 흔한 동물일수록 빨리 자라고 보상이 작다
const SPECIES: (typeof animalSpecies.$inferInsert)[] = [
  { code: "chick", name: "병아리", assetKey: "animal.chick", growExp: 60, rewardExp: 50, rewardCoins: 20, hatchWeight: 40 },
  { code: "bunny", name: "토끼", assetKey: "animal.bunny", growExp: 90, rewardExp: 80, rewardCoins: 30, hatchWeight: 30 },
  { code: "piglet", name: "아기 돼지", assetKey: "animal.piglet", growExp: 120, rewardExp: 110, rewardCoins: 50, hatchWeight: 20 },
  { code: "calf", name: "송아지", assetKey: "animal.calf", growExp: 160, rewardExp: 160, rewardCoins: 80, hatchWeight: 10 },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    for (const raw of ITEMS) {
      // 캐릭터와 기본 아이템은 팔지 않는다 (SHOP-01, D12). 나머지는 판매 중
      const item = { ...raw, isOnSale: raw.type !== "character" && !raw.isStarter };
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
            avatarSlot: item.avatarSlot ?? null,
            growthValue: item.growthValue ?? null,
            isOnSale: item.isOnSale,
          },
        });
    }
    for (const sp of SPECIES) {
      await db
        .insert(animalSpecies)
        .values(sp)
        .onConflictDoUpdate({
          target: animalSpecies.code,
          set: {
            name: sp.name,
            assetKey: sp.assetKey,
            growExp: sp.growExp,
            rewardExp: sp.rewardExp,
            rewardCoins: sp.rewardCoins,
            hatchWeight: sp.hatchWeight,
          },
        });
    }
    const rows = await db.execute(sql`SELECT type, COUNT(*)::int AS n FROM items GROUP BY type ORDER BY type`);
    console.log("✔ 아이템 시드 완료", rows.rows, `동물 ${SPECIES.length}종`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
