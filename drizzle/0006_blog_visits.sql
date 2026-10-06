-- BLOG-06 (2026-10-06): 블로그 방문자. 같은 사람(쿠키)은 한 블로그에 하루 1줄 (기본 키)
CREATE TABLE "blog_visits" (
	"blog_id" integer NOT NULL,
	"date" date NOT NULL,
	"visitor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_visits_blog_id_date_visitor_id_pk" PRIMARY KEY("blog_id","date","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "blog_visits" ADD CONSTRAINT "blog_visits_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE cascade ON UPDATE no action;