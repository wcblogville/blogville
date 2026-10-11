-- 미용실 (SHOP-07, 사용자 요청 2026-10-11): 아바타 부위에 머리 모양(hair)·머리 색(hair_color)을 더한다. 아이템은 npm run db:seed
ALTER TYPE "public"."avatar_slot" ADD VALUE 'hair';--> statement-breakpoint
ALTER TYPE "public"."avatar_slot" ADD VALUE 'hair_color';