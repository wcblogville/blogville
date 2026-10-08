-- BLOG-05 (2026-10-07): 카테고리 2단계, 소분류 표 (ERD 3.18)
CREATE TABLE "subcategories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subcategories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "subcategories_category_name_uq" UNIQUE("category_id","name"),
	CONSTRAINT "subcategories_category_id_uq" UNIQUE("category_id","id"),
	CONSTRAINT "subcategories_name_check" CHECK (char_length("subcategories"."name") BETWEEN 1 AND 20)
);
--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
