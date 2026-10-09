-- 지붕 색 10개 (사용자 결정 2026-10-09): 집 10단계마다 하나씩 열리도록 분홍·민트 추가
ALTER TABLE "blogs" DROP CONSTRAINT "blogs_roof_color_check";--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_roof_color_check" CHECK ("blogs"."roof_color" IS NULL OR "blogs"."roof_color" IN ('red', 'orange', 'yellow', 'green', 'sky', 'blue', 'purple', 'brown', 'pink', 'mint'));