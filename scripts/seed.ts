// 아이템 카탈로그 기본 데이터. 여러 번 실행해도 안전하다 (code 기준으로 덮어쓰기).
// 실행: npm run db:seed
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { animalSkins, animalSpecies, items } from "../src/db/schema";
import { ensureNoticePosts, noticePostsMessage } from "./notice-posts";
import { hatchWeightOf } from "../src/lib/farm";

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
  // 가구 더하기 (사용자 요청 2026-10-11 "돈 사용할 사용처 많아지게"): 싼 소품부터 오래 모아야 하는 가구까지. 그림은 src/lib/art/furniture.ts
  { code: "fur_stool", type: "furniture", name: "나무 스툴", description: "잠깐 걸터앉기 좋은 동그란 스툴", price: 30, requiredLevel: 1, isStarter: false, assetKey: "furniture.stool" },
  { code: "fur_cactus", type: "furniture", name: "선인장 화분", description: "물을 자주 안 줘도 꽃이 피는 선인장", price: 35, requiredLevel: 1, isStarter: false, assetKey: "furniture.cactus" },
  { code: "fur_crate", type: "furniture", name: "과일 상자", description: "사과와 귤이 가득 담긴 나무 상자", price: 45, requiredLevel: 1, isStarter: false, assetKey: "furniture.crate" },
  { code: "fur_yarn", type: "furniture", name: "털실 바구니", description: "뜨개질하다 만 털실이 담긴 바구니", price: 55, requiredLevel: 1, isStarter: false, assetKey: "furniture.yarn" },
  { code: "fur_tulip", type: "furniture", name: "튤립 화분", description: "빨강·분홍·노랑 튤립이 핀 화분", price: 60, requiredLevel: 1, isStarter: false, assetKey: "furniture.tulip" },
  { code: "fur_radio", type: "furniture", name: "라디오", description: "마을 소식이 흘러나오는 옛날 라디오", price: 80, requiredLevel: 2, isStarter: false, assetKey: "furniture.radio" },
  { code: "fur_beanbag", type: "furniture", name: "빈백 소파", description: "앉으면 몸이 폭 파묻히는 콩주머니 소파", price: 90, requiredLevel: 2, isStarter: false, assetKey: "furniture.beanbag" },
  { code: "fur_bear", type: "furniture", name: "곰 인형", description: "빨간 리본을 맨 커다란 곰 인형", price: 100, requiredLevel: 2, isStarter: false, assetKey: "furniture.bear" },
  { code: "fur_desk", type: "furniture", name: "나무 책상", description: "공책과 연필, 머그잔이 놓인 책상", price: 110, requiredLevel: 2, isStarter: false, assetKey: "furniture.desk" },
  { code: "fur_globe", type: "furniture", name: "지구본", description: "가 보고 싶은 곳을 빙글빙글 찾아보는 지구본", price: 130, requiredLevel: 3, isStarter: false, assetKey: "furniture.globe" },
  { code: "fur_dresser", type: "furniture", name: "거울 서랍장", description: "동그란 거울이 달린 세 칸 서랍장", price: 140, requiredLevel: 3, isStarter: false, assetKey: "furniture.dresser" },
  { code: "fur_armchair", type: "furniture", name: "안락의자", description: "등받이가 높은 푹신한 분홍 의자", price: 160, requiredLevel: 3, isStarter: false, assetKey: "furniture.armchair" },
  { code: "fur_wardrobe", type: "furniture", name: "옷장", description: "옷가게에서 산 옷을 걸어 두는 큰 옷장", price: 180, requiredLevel: 3, isStarter: false, assetKey: "furniture.wardrobe" },
  { code: "fur_cupboard", type: "furniture", name: "그릇 찬장", description: "예쁜 접시를 진열한 찬장", price: 200, requiredLevel: 4, isStarter: false, assetKey: "furniture.cupboard" },
  { code: "fur_fridge", type: "furniture", name: "냉장고", description: "민트색 옛날 냉장고", price: 220, requiredLevel: 4, isStarter: false, assetKey: "furniture.fridge" },
  { code: "fur_stove", type: "furniture", name: "주방 화덕", description: "오븐에서 빵 굽는 냄새가 솔솔", price: 240, requiredLevel: 4, isStarter: false, assetKey: "furniture.stove" },
  { code: "fur_monstera", type: "furniture", name: "몬스테라", description: "구멍 뚫린 커다란 잎이 멋진 화분", price: 260, requiredLevel: 5, isStarter: false, assetKey: "furniture.monstera" },
  { code: "fur_easel", type: "furniture", name: "이젤", description: "그리다 만 마을 풍경이 걸린 이젤", price: 280, requiredLevel: 5, isStarter: false, assetKey: "furniture.easel" },
  { code: "fur_mushroom", type: "furniture", name: "버섯 조명", description: "밤이면 은은하게 빛나는 빨간 버섯", price: 300, requiredLevel: 5, isStarter: false, assetKey: "furniture.mushroom" },
  { code: "fur_tv", type: "furniture", name: "브라운관 TV", description: "안테나를 세우면 무지개 화면이 나와요", price: 350, requiredLevel: 6, isStarter: false, assetKey: "furniture.tv" },
  { code: "fur_clock", type: "furniture", name: "괘종시계", description: "정각마다 댕댕 울리는 키 큰 시계", price: 400, requiredLevel: 6, isStarter: false, assetKey: "furniture.clock" },
  { code: "fur_aquarium", type: "furniture", name: "어항", description: "물고기가 헤엄치는 커다란 어항", price: 450, requiredLevel: 7, isStarter: false, assetKey: "furniture.aquarium" },
  { code: "fur_bonsai", type: "furniture", name: "분재", description: "오래오래 정성으로 가꾼 소나무 분재", price: 500, requiredLevel: 8, isStarter: false, assetKey: "furniture.bonsai" },
  { code: "fur_gramophone", type: "furniture", name: "축음기", description: "금빛 나팔에서 옛 노래가 흘러나와요", price: 600, requiredLevel: 8, isStarter: false, assetKey: "furniture.gramophone" },
  { code: "fur_fireplace", type: "furniture", name: "벽난로", description: "장작이 타닥타닥 타는 따뜻한 벽난로", price: 700, requiredLevel: 10, isStarter: false, assetKey: "furniture.fireplace" },
  { code: "fur_xmastree", type: "furniture", name: "크리스마스 트리", description: "별과 선물이 가득한 트리", price: 750, requiredLevel: 10, isStarter: false, assetKey: "furniture.xmastree" },
  { code: "fur_piano", type: "furniture", name: "피아노", description: "까만 업라이트 피아노", price: 900, requiredLevel: 12, isStarter: false, assetKey: "furniture.piano" },
  { code: "fur_computer", type: "furniture", name: "컴퓨터 책상", description: "블로그 글을 쓰는 나만의 작업실", price: 1000, requiredLevel: 12, isStarter: false, assetKey: "furniture.computer" },
  { code: "fur_canopy", type: "furniture", name: "캐노피 침대", description: "보랏빛 휘장이 드리운 공주님 침대", price: 1500, requiredLevel: 15, isStarter: false, assetKey: "furniture.canopy" },
  { code: "fur_throne", type: "furniture", name: "황금 왕좌", description: "마을에서 가장 꾸준한 블로거의 자리", price: 3000, requiredLevel: 20, isStarter: false, assetKey: "furniture.throne" },
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
  // 옷가게 더하기 (사용자 요청 2026-10-11): 옷 12벌·모자 8개·소품 7개. 비싼 옷(공주 드레스·왕자 옷·황금 예복)은 오래 모으는 목표
  { code: "outfit_tshirt", type: "avatar", avatarSlot: "outfit", name: "줄무늬 티셔츠", description: "빨강·하양 줄무늬 반팔 티셔츠", price: 60, requiredLevel: 1, isStarter: false, assetKey: "outfit.tshirt" },
  { code: "outfit_raincoat", type: "avatar", avatarSlot: "outfit", name: "노란 비옷", description: "비 오는 날에도 신나는 비옷과 장화", price: 110, requiredLevel: 1, isStarter: false, assetKey: "outfit.raincoat" },
  { code: "outfit_tracksuit", type: "avatar", avatarSlot: "outfit", name: "체육복", description: "하얀 줄이 들어간 파란 체육복", price: 120, requiredLevel: 2, isStarter: false, assetKey: "outfit.tracksuit" },
  { code: "outfit_sweater", type: "avatar", avatarSlot: "outfit", name: "니트 스웨터", description: "분홍 하트를 뜨개질한 초록 스웨터", price: 130, requiredLevel: 2, isStarter: false, assetKey: "outfit.sweater" },
  { code: "outfit_sailor", type: "avatar", avatarSlot: "outfit", name: "세일러복", description: "남색 깃과 빨간 스카프의 세일러복", price: 180, requiredLevel: 3, isStarter: false, assetKey: "outfit.sailor" },
  { code: "outfit_doctor", type: "avatar", avatarSlot: "outfit", name: "의사 가운", description: "청진기를 건 하얀 가운", price: 250, requiredLevel: 3, isStarter: false, assetKey: "outfit.doctor" },
  { code: "outfit_pirate", type: "avatar", avatarSlot: "outfit", name: "해적 옷", description: "검은 조끼와 줄무늬 바지, 장화", price: 350, requiredLevel: 4, isStarter: false, assetKey: "outfit.pirate" },
  { code: "outfit_ninja", type: "avatar", avatarSlot: "outfit", name: "닌자 옷", description: "밤에도 눈에 띄지 않는 까만 옷", price: 450, requiredLevel: 5, isStarter: false, assetKey: "outfit.ninja" },
  { code: "outfit_astronaut", type: "avatar", avatarSlot: "outfit", name: "우주복", description: "우주 배경과 잘 어울리는 하얀 우주복", price: 900, requiredLevel: 7, isStarter: false, assetKey: "outfit.astronaut" },
  { code: "outfit_prince", type: "avatar", avatarSlot: "outfit", name: "왕자 옷", description: "금빛 견장을 단 파란 왕자 옷", price: 1200, requiredLevel: 8, isStarter: false, assetKey: "outfit.prince" },
  { code: "outfit_princess", type: "avatar", avatarSlot: "outfit", name: "공주 드레스", description: "분홍 리본이 겹겹이 달린 드레스", price: 1200, requiredLevel: 8, isStarter: false, assetKey: "outfit.princess" },
  { code: "outfit_royal", type: "avatar", avatarSlot: "outfit", name: "황금 예복", description: "털 깃과 빨간 망토를 두른 임금님 옷", price: 2500, requiredLevel: 12, isStarter: false, assetKey: "outfit.royal" },
  { code: "hat_cap", type: "avatar", avatarSlot: "hat", name: "야구 모자", description: "햇빛을 가려 주는 파란 야구 모자", price: 50, requiredLevel: 1, isStarter: false, assetKey: "hat.cap" },
  { code: "hat_flower", type: "avatar", avatarSlot: "hat", name: "꽃 화관", description: "들꽃을 엮어 만든 화관", price: 90, requiredLevel: 1, isStarter: false, assetKey: "hat.flower" },
  { code: "hat_beret", type: "avatar", avatarSlot: "hat", name: "베레모", description: "그림 그리는 날 쓰는 빨간 베레모", price: 110, requiredLevel: 2, isStarter: false, assetKey: "hat.beret" },
  { code: "hat_catears", type: "avatar", avatarSlot: "hat", name: "고양이 귀 머리띠", description: "쫑긋한 까만 고양이 귀", price: 130, requiredLevel: 2, isStarter: false, assetKey: "hat.catears" },
  { code: "hat_santa", type: "avatar", avatarSlot: "hat", name: "산타 모자", description: "흰 방울이 달린 빨간 산타 모자", price: 150, requiredLevel: 3, isStarter: false, assetKey: "hat.santa" },
  { code: "hat_tophat", type: "avatar", avatarSlot: "hat", name: "실크햇", description: "빨간 띠를 두른 까만 신사 모자", price: 280, requiredLevel: 5, isStarter: false, assetKey: "hat.tophat" },
  { code: "hat_pirate", type: "avatar", avatarSlot: "hat", name: "해적 모자", description: "해골 무늬가 그려진 선장 모자", price: 350, requiredLevel: 5, isStarter: false, assetKey: "hat.pirate" },
  { code: "hat_tiara", type: "avatar", avatarSlot: "hat", name: "보석 티아라", description: "보석이 반짝이는 금빛 티아라", price: 1500, requiredLevel: 10, isStarter: false, assetKey: "hat.tiara" },
  { code: "acc_bowtie", type: "avatar", avatarSlot: "accessory", name: "나비넥타이", description: "목에 다는 빨간 나비넥타이", price: 60, requiredLevel: 1, isStarter: false, assetKey: "acc.bowtie" },
  { code: "acc_sunglasses", type: "avatar", avatarSlot: "accessory", name: "선글라스", description: "햇살 좋은 날의 까만 선글라스", price: 90, requiredLevel: 1, isStarter: false, assetKey: "acc.sunglasses" },
  { code: "acc_headphones", type: "avatar", avatarSlot: "accessory", name: "헤드폰", description: "좋아하는 노래를 들으며 글쓰기", price: 180, requiredLevel: 3, isStarter: false, assetKey: "acc.headphones" },
  { code: "acc_necklace", type: "avatar", avatarSlot: "accessory", name: "진주 목걸이", description: "하늘빛 보석이 달린 진주 목걸이", price: 220, requiredLevel: 3, isStarter: false, assetKey: "acc.necklace" },
  { code: "acc_monocle", type: "avatar", avatarSlot: "accessory", name: "외눈 안경", description: "금빛 줄이 달린 신사의 외눈 안경", price: 250, requiredLevel: 4, isStarter: false, assetKey: "acc.monocle" },
  { code: "acc_mask", type: "avatar", avatarSlot: "accessory", name: "무도회 가면", description: "깃털 장식이 달린 보라 가면", price: 300, requiredLevel: 5, isStarter: false, assetKey: "acc.mask" },
  { code: "acc_medal", type: "avatar", avatarSlot: "accessory", name: "금메달", description: "꾸준히 쓴 블로거에게 주는 금메달", price: 600, requiredLevel: 6, isStarter: false, assetKey: "acc.medal" },
  // 미용실 더하기 (사용자 요청 2026-10-11): 머리 모양 9가지·머리 색 8가지
  { code: "hair_side", type: "avatar", avatarSlot: "hair", name: "옆가르마", description: "한쪽으로 쓸어 넘긴 단정한 머리", price: 30, requiredLevel: 1, isStarter: false, assetKey: "hair.side" },
  { code: "hair_bowl", type: "avatar", avatarSlot: "hair", name: "바가지 머리", description: "눈썹 위에서 동그랗게 자른 머리", price: 50, requiredLevel: 1, isStarter: false, assetKey: "hair.bowl" },
  { code: "hair_topknot", type: "avatar", avatarSlot: "hair", name: "상투", description: "정수리에 빨간 끈으로 묶은 머리", price: 70, requiredLevel: 1, isStarter: false, assetKey: "hair.topknot" },
  { code: "hair_mohawk", type: "avatar", avatarSlot: "hair", name: "닭벼슬 머리", description: "가운데만 높이 세운 머리", price: 100, requiredLevel: 2, isStarter: false, assetKey: "hair.mohawk" },
  { code: "hair_braids", type: "avatar", avatarSlot: "hair", name: "양갈래 땋은 머리", description: "양쪽으로 길게 땋아 내린 머리", price: 110, requiredLevel: 2, isStarter: false, assetKey: "hair.braids" },
  { code: "hair_hime", type: "avatar", avatarSlot: "hair", name: "히메컷", description: "일자 앞머리에 볼 옆을 자른 긴 머리", price: 140, requiredLevel: 3, isStarter: false, assetKey: "hair.hime" },
  { code: "hair_afro", type: "avatar", avatarSlot: "hair", name: "아프로", description: "둥글고 크게 부푼 곱슬머리", price: 150, requiredLevel: 3, isStarter: false, assetKey: "hair.afro" },
  { code: "hair_wavy", type: "avatar", avatarSlot: "hair", name: "웨이브 장발", description: "물결치며 어깨 아래로 퍼지는 머리", price: 180, requiredLevel: 4, isStarter: false, assetKey: "hair.wavy" },
  { code: "hair_royal", type: "avatar", avatarSlot: "hair", name: "공주 롤 머리", description: "양옆을 돌돌 만 큰 컬 머리", price: 400, requiredLevel: 6, isStarter: false, assetKey: "hair.royal" },
  { code: "haircolor_ash", type: "avatar", avatarSlot: "hair_color", name: "애쉬 그레이", description: "차분한 잿빛", price: 40, requiredLevel: 1, isStarter: false, assetKey: "haircolor.ash" },
  { code: "haircolor_orange", type: "avatar", avatarSlot: "hair_color", name: "주황 머리", description: "귤처럼 상큼한 주황색", price: 50, requiredLevel: 1, isStarter: false, assetKey: "haircolor.orange" },
  { code: "haircolor_sky", type: "avatar", avatarSlot: "hair_color", name: "하늘 머리", description: "맑은 하늘색", price: 70, requiredLevel: 2, isStarter: false, assetKey: "haircolor.sky" },
  { code: "haircolor_navy", type: "avatar", avatarSlot: "hair_color", name: "남색 머리", description: "깊은 밤하늘 같은 남색", price: 70, requiredLevel: 2, isStarter: false, assetKey: "haircolor.navy" },
  { code: "haircolor_green", type: "avatar", avatarSlot: "hair_color", name: "초록 머리", description: "새싹 같은 초록색", price: 80, requiredLevel: 2, isStarter: false, assetKey: "haircolor.green" },
  { code: "haircolor_wine", type: "avatar", avatarSlot: "hair_color", name: "와인 머리", description: "짙은 와인빛 빨강", price: 100, requiredLevel: 3, isStarter: false, assetKey: "haircolor.wine" },
  { code: "haircolor_white", type: "avatar", avatarSlot: "hair_color", name: "백발", description: "눈처럼 하얀색", price: 150, requiredLevel: 4, isStarter: false, assetKey: "haircolor.white" },
  { code: "haircolor_gold", type: "avatar", avatarSlot: "hair_color", name: "황금 머리", description: "눈부신 황금색", price: 300, requiredLevel: 6, isStarter: false, assetKey: "haircolor.gold" },
  // 성장 아이템 (SHOP-01 2026-10-07, TOWN-09): 여러 번 사서 모으고 농장에서 쓴다
  { code: "growth_feed", type: "growth", growthValue: 20, name: "동물 먹이", description: "동물이 조금 자라요 (성장 +20)", price: 20, requiredLevel: 1, isStarter: false, assetKey: "growth.feed" },
  { code: "growth_premium", type: "growth", growthValue: 50, name: "고급 먹이", description: "영양 가득한 먹이 (성장 +50)", price: 60, requiredLevel: 1, isStarter: false, assetKey: "growth.premium" },
  { code: "growth_booster", type: "growth", growthValue: 100, name: "성장 촉진제", description: "쑥쑥 자라는 특별한 물약 (성장 +100)", price: 150, requiredLevel: 3, isStarter: false, assetKey: "growth.booster" },
  { code: "growth_elixir", type: "growth", growthValue: 300, name: "황금 성장 물약", description: "금빛으로 반짝이는 귀한 물약 (성장 +300)", price: 400, requiredLevel: 6, isStarter: false, assetKey: "growth.elixir" },
];

// 동물 농장 동물 종류 (TOWN-09). 흔한 동물일수록 빨리 자라고 보상이 작다.
// 알 확률(hatch_weight, 만분율)은 src/lib/farm.ts HATCH_RARITY·RARITY_ODDS 한 곳에서 정한다 (2026-10-12 "노말한 동물들이랑 희귀한 애들이랑 확률 다르게"):
// 일반 60%(병아리·토끼·햄스터), 희귀 32%(아기 돼지·아기 고양이·강아지·아기 양), 아주 희귀 8%(송아지·조랑말). 아홉 종류 모두 알에서 나온다.
// 값(price)이 있는 종류는 농장 [동물 분양]에서 코인으로 바로 고를 수도 있다. 크기(작은·중간·큰)는 src/lib/art/animals.ts ANIMAL_SIZE
const SPECIES: (typeof animalSpecies.$inferInsert)[] = [
  { code: "chick", name: "병아리", assetKey: "animal.chick", growExp: 60, rewardExp: 50, rewardCoins: 20 },
  { code: "bunny", name: "토끼", assetKey: "animal.bunny", growExp: 90, rewardExp: 80, rewardCoins: 30 },
  { code: "piglet", name: "아기 돼지", assetKey: "animal.piglet", growExp: 120, rewardExp: 110, rewardCoins: 50 },
  { code: "calf", name: "송아지", assetKey: "animal.calf", growExp: 160, rewardExp: 160, rewardCoins: 80 },
  { code: "hamster", name: "햄스터", assetKey: "animal.hamster", growExp: 70, rewardExp: 60, rewardCoins: 20, price: 200 },
  { code: "kitten", name: "아기 고양이", assetKey: "animal.kitten", growExp: 100, rewardExp: 90, rewardCoins: 30, price: 300 },
  { code: "puppy", name: "강아지", assetKey: "animal.puppy", growExp: 110, rewardExp: 100, rewardCoins: 35, price: 350 },
  { code: "lamb", name: "아기 양", assetKey: "animal.lamb", growExp: 130, rewardExp: 120, rewardCoins: 45, price: 400 },
  { code: "pony", name: "조랑말", assetKey: "animal.pony", growExp: 180, rewardExp: 180, rewardCoins: 70, price: 600 },
].map((sp) => ({ ...sp, hatchWeight: hatchWeightOf(sp.code) }));

// 동물 스킨 (2026-10-11 "펫 종류별로 스킨"): 종류마다 둘. 색·무늬는 src/lib/art/animals.ts ANIMAL_SKINS (asset_key)
const SKINS: { code: string; species: string; name: string; price: number }[] = [
  { code: "chick_choco", species: "chick", name: "초코 병아리", price: 120 },
  { code: "chick_mint", species: "chick", name: "민트 병아리", price: 150 },
  { code: "bunny_gray", species: "bunny", name: "회색 토끼", price: 120 },
  // 이름이 특별 진화(얼룩 토끼·흑돼지·딸기우유 송아지, src/lib/farm.ts SPECIAL_VARIANTS)와 겹치지 않게 바꿨다 (2026-10-12)
  { code: "bunny_patch", species: "bunny", name: "갈색 점 토끼", price: 180 },
  { code: "hamster_snow", species: "hamster", name: "눈송이 햄스터", price: 150 },
  { code: "hamster_choco", species: "hamster", name: "초코 햄스터", price: 150 },
  { code: "kitten_black", species: "kitten", name: "까망이", price: 200 },
  { code: "kitten_calico", species: "kitten", name: "삼색이", price: 250 },
  { code: "puppy_shiba", species: "puppy", name: "시바 강아지", price: 200 },
  { code: "puppy_choco", species: "puppy", name: "초코 강아지", price: 200 },
  { code: "piglet_spot", species: "piglet", name: "점박이 돼지", price: 180 },
  { code: "piglet_black", species: "piglet", name: "먹색 돼지", price: 200 },
  { code: "lamb_black", species: "lamb", name: "까만 양", price: 220 },
  { code: "lamb_pink", species: "lamb", name: "솜사탕 양", price: 250 },
  { code: "calf_hanwoo", species: "calf", name: "누렁 송아지", price: 220 },
  { code: "calf_strawberry", species: "calf", name: "분홍 점 송아지", price: 260 },
  { code: "pony_white", species: "pony", name: "백마", price: 300 },
  { code: "pony_zebra", species: "pony", name: "얼룩말", price: 350 },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    for (const raw of ITEMS) {
      // 캐릭터와 기본 아이템은 팔지 않는다 (SHOP-01, D12). 나머지는 판매 중.
      // 광장 장식은 광장 꾸미기를 쉬면서(사용자 결정 2026-10-11, TOWN-16) 팔지 않는다. 이미 산 장식·표는 그대로 둔다
      const item = { ...raw, isOnSale: raw.type !== "character" && raw.type !== "deco" && !raw.isStarter };
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
            price: sp.price ?? null,
          },
        });
    }
    const speciesIds = new Map((await db.select({ id: animalSpecies.id, code: animalSpecies.code }).from(animalSpecies)).map((r) => [r.code, r.id]));
    for (const sk of SKINS) {
      const speciesId = speciesIds.get(sk.species);
      if (!speciesId) throw new Error(`스킨 ${sk.code}: 동물 종류 ${sk.species}가 없어요`);
      const row = { code: sk.code, speciesId, name: sk.name, price: sk.price, assetKey: `skin.${sk.code.replace("_", ".")}` };
      await db
        .insert(animalSkins)
        .values(row)
        .onConflictDoUpdate({ target: animalSkins.code, set: { name: row.name, price: row.price, assetKey: row.assetKey } });
    }
    const rows = await db.execute(sql`SELECT type, COUNT(*)::int AS n FROM items GROUP BY type ORDER BY type`);
    console.log("✔ 아이템 시드 완료", rows.rows, `동물 ${SPECIES.length}종, 스킨 ${SKINS.length}개`);
    // 마을 소식 맨 위 첫 공지·릴리스 노트 (관리자가 있을 때만, 이미 있는 글은 건너뜀). 첫 배포는 관리자가 아직 없어 admin:create가 넣는다
    console.log(noticePostsMessage(await ensureNoticePosts(db, process.env.ADMIN_USERNAME?.trim().toLowerCase() || undefined)));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
