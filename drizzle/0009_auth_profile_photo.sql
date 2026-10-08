-- AUTH-03 (2026-10-08): 프로필 사진 칸 (ERD 3.9, research R16, data-model 4장 A3)
-- 값은 비어 있고 올리는 화면은 아직 없다. 표시하는 쪽은 "사진이 없으면 캐릭터 얼굴". 첨부 행이 지워지면 사진만 비운다.
ALTER TABLE "profiles" ADD COLUMN "photo_key" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_photo_key_fk" FOREIGN KEY ("photo_key") REFERENCES "public"."attachments"("key") ON DELETE set null ON UPDATE no action;