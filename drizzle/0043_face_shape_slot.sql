-- 미용실 얼굴형 (사용자 요청 2026-10-12 "얼굴형도 추가 해줘 동그란 얼굴 그런거"): 아바타 부위에 얼굴형(face_shape)을 더한다. 아이템은 npm run db:seed
ALTER TYPE "public"."avatar_slot" ADD VALUE 'face_shape';