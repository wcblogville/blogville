#!/usr/bin/env bash
# 서버에서 실행하는 배포 스크립트. GitHub Actions가 SSH로 접속해 부른다 (.github/workflows/deploy.yml).
# 같은 폴더에 blogville.tar.gz(도커 이미지)와 .env(접속 정보)가 있어야 한다.
#   APP_PORT=8300 bash scripts/deploy.sh
set -euo pipefail

APP_PORT="${APP_PORT:?APP_PORT(내 포트 번호)가 필요해요}"
NAME=blogville
IMAGE=blogville:latest
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

echo "▶ 이미지 불러오기"
gunzip -c blogville.tar.gz | docker load
rm -f blogville.tar.gz

echo "▶ DB 준비 (표 만들기 → 기본 아이템 → 관리자). 이미 된 것은 건너뛴다"
docker run --rm --env-file .env "$IMAGE" \
  sh -c "npm run -s db:migrate:deploy && npm run -s db:seed && npm run -s admin:create"

echo "▶ 앱 다시 띄우기 (포트 $APP_PORT)"
mkdir -p uploads
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
  --env-file .env \
  -p "$APP_PORT:3000" \
  -v "$DIR/uploads:/app/storage/uploads" \
  "$IMAGE"

echo "▶ 안 쓰는 옛 이미지 정리"
docker image prune -f >/dev/null

sleep 5
if docker ps --filter "name=^${NAME}$" --filter status=running -q | grep -q .; then
  echo "✔ 배포 완료: 서버의 $APP_PORT 포트에서 실행 중"
else
  echo "✘ 앱이 멈췄어요. 마지막 로그:"
  docker logs --tail 50 "$NAME"
  exit 1
fi
