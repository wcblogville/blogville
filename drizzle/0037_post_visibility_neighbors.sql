-- 이웃 공개 (2026-10-12 사용자 요청): 주인과 주인을 이웃 추가한 회원만 보는 글
ALTER TYPE "public"."visibility" ADD VALUE 'neighbors' BEFORE 'private';
