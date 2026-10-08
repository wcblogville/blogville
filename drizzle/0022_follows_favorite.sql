-- SOC-04/TOWN-08 (2026-10-07): 즐겨찾는 이웃 표시. 기존 행은 false (백필 없음).
ALTER TABLE "follows" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;