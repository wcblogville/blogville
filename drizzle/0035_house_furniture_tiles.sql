-- 우리 집 가구 자유 배치 (사용자 요청 2026-10-12 "가구 배치 내 마음대로 할 수 있게", "정육면체 형태로"):
-- 줄 선 칸(slot 0~7) 대신 아이소메트릭 방 바닥 칸(tile_x, tile_y, 0~9)과 좌우 뒤집기(flipped).
-- 옛 칸은 src/lib/house.ts DEFAULT_TILES와 같은 자리로 옮긴다 (가장 작은 6×6 방 안, 서로 겹치지 않음).
-- 같은 가구는 한 번만 → PK (user_id, item_id), 한 칸에는 하나만 → house_furniture_tile_uq
ALTER TABLE "house_furniture" ADD COLUMN "tile_x" integer;--> statement-breakpoint
ALTER TABLE "house_furniture" ADD COLUMN "tile_y" integer;--> statement-breakpoint
ALTER TABLE "house_furniture" ADD COLUMN "flipped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "house_furniture" SET
  "tile_x" = (ARRAY[0, 2, 0, 4, 2, 3, 5, 1])["slot" + 1],
  "tile_y" = (ARRAY[1, 0, 3, 0, 2, 4, 2, 5])["slot" + 1];--> statement-breakpoint
ALTER TABLE "house_furniture" ALTER COLUMN "tile_x" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "house_furniture" ALTER COLUMN "tile_y" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "house_furniture" DROP CONSTRAINT "house_furniture_user_id_slot_pk";--> statement-breakpoint
ALTER TABLE "house_furniture" DROP CONSTRAINT "house_furniture_item_uq";--> statement-breakpoint
ALTER TABLE "house_furniture" DROP CONSTRAINT "house_furniture_slot_check";--> statement-breakpoint
ALTER TABLE "house_furniture" DROP COLUMN "slot";--> statement-breakpoint
ALTER TABLE "house_furniture" ADD CONSTRAINT "house_furniture_user_id_item_id_pk" PRIMARY KEY("user_id","item_id");--> statement-breakpoint
ALTER TABLE "house_furniture" ADD CONSTRAINT "house_furniture_tile_uq" UNIQUE("user_id","tile_x","tile_y");--> statement-breakpoint
ALTER TABLE "house_furniture" ADD CONSTRAINT "house_furniture_tile_check" CHECK ("house_furniture"."tile_x" BETWEEN 0 AND 9 AND "house_furniture"."tile_y" BETWEEN 0 AND 9);
