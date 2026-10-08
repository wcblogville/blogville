CREATE TABLE "house_furniture" (
	"user_id" text NOT NULL,
	"slot" integer NOT NULL,
	"item_id" integer NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "house_furniture_user_id_slot_pk" PRIMARY KEY("user_id","slot"),
	CONSTRAINT "house_furniture_item_uq" UNIQUE("user_id","item_id"),
	CONSTRAINT "house_furniture_slot_check" CHECK ("house_furniture"."slot" BETWEEN 0 AND 7)
);
--> statement-breakpoint
ALTER TABLE "house_furniture" ADD CONSTRAINT "house_furniture_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_furniture" ADD CONSTRAINT "house_furniture_owned_fk" FOREIGN KEY ("user_id","item_id") REFERENCES "public"."user_items"("user_id","item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 가구 아이템 (scripts/seed.ts와 같은 값). 화분·나무 의자는 모두에게 주는 기본 가구(is_starter)
INSERT INTO "items" ("code", "type", "name", "description", "price", "required_level", "is_starter", "asset_key") VALUES
	('fur_plant', 'furniture', '초록 화분', '집 안을 싱그럽게 해 주는 화분', 0, 1, true, 'furniture.plant'),
	('fur_chair', 'furniture', '나무 의자', '처음 이사 온 날부터 함께한 의자', 0, 1, true, 'furniture.chair'),
	('fur_table', 'furniture', '둥근 탁자', '따뜻한 차 한 잔 놓기 좋은 탁자', 40, 1, false, 'furniture.table'),
	('fur_rug', 'furniture', '알록달록 러그', '발이 포근해지는 동그란 러그', 50, 1, false, 'furniture.rug'),
	('fur_shelf', 'furniture', '책장', '읽은 책과 쓴 글이 쌓이는 책장', 80, 2, false, 'furniture.shelf'),
	('fur_lamp', 'furniture', '스탠드 조명', '밤에 글 쓸 때 켜는 조명', 60, 2, false, 'furniture.lamp'),
	('fur_bed', 'furniture', '포근한 침대', '푹 자고 일어나면 글이 술술', 120, 3, false, 'furniture.bed'),
	('fur_sofa', 'furniture', '푹신한 소파', '이웃이 놀러 오면 앉는 소파', 200, 4, false, 'furniture.sofa')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
-- 이미 가입한 회원에게도 기본 가구를 준다
INSERT INTO "user_items" ("user_id", "item_id")
SELECT "b"."owner_id", "i"."id" FROM "blogs" "b" CROSS JOIN "items" "i"
WHERE "i"."type" = 'furniture' AND "i"."is_starter"
ON CONFLICT DO NOTHING;
