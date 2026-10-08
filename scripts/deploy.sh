#!/usr/bin/env bash
# 서버에서 실행하는 배포 스크립트. GitHub Actions가 SSH로 접속해 부른다 (.github/workflows/deploy.yml).
# 같은 폴더에 blogville.tar.gz(도커 이미지)와 .env(접속 정보, 워크플로가 SSH에서 만든다)가 있어야 한다.
#   APP_PORT=8420 bash scripts/deploy.sh
set -euo pipefail

APP_PORT="${APP_PORT:?APP_PORT(내 포트 번호)가 필요해요}"
NAME=blogville
IMAGE=blogville:latest
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
chmod 700 "$DIR" # 공용 서버라 다른 계정이 .env·.secrets·첨부를 못 보게

# BETTER_AUTH_SECRET·관리자 아이디·비밀번호가 GitHub secrets에 없으면 서버에서 한 번 만들어
# .secrets에 보관하고 다음 배포부터 같은 값을 쓴다. 관리자 비밀번호 보기: cat ~/blogville/.secrets
random_hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
fill_secret() {
  local key="$1" make="$2" value
  grep -q "^${key}=." .env && return 0
  touch .secrets && chmod 600 .secrets
  value="$(grep "^${key}=" .secrets | head -n 1 | cut -d= -f2- || true)"
  if [ -z "$value" ]; then
    value="$($make)"
    echo "${key}=${value}" >> .secrets
  fi
  sed -i "/^${key}=/d" .env
  echo "${key}=${value}" >> .env
}
fill_secret BETTER_AUTH_SECRET "random_hex 32"
fill_secret ADMIN_USERNAME "echo admin"
fill_secret ADMIN_PASSWORD "random_hex 12"

echo "▶ 이미지 불러오기"
OLD_IMAGE="$(docker image inspect -f '{{.Id}}' "$IMAGE" 2>/dev/null || true)"
gunzip -c blogville.tar.gz | docker load
rm -f blogville.tar.gz

# 컨테이너 안에서 DB 포트에 접속해 본다. 인자: 이름표, docker run 옵션 (예: --network host)
db_reachable() {
  local label="$1"
  shift
  docker run --rm --env-file .env "$@" "$IMAGE" node -e '
    const label = process.argv[1], u = new URL(process.env.DATABASE_URL);
    const s = require("node:net").connect({ host: u.hostname, port: Number(u.port || 5432), timeout: 8000 });
    s.on("connect", () => { console.log(`  ${label}: 접속 OK`); process.exit(0); });
    s.on("timeout", () => { console.log(`  ${label}: 시간 초과`); process.exit(1); });
    s.on("error", (e) => { console.log(`  ${label}: ${e.code} ${e.address || ""}`); process.exit(1); });' "$label"
}

# 도커 기본 네트워크에서 DB에 못 가면 서버의 네트워크를 그대로 쓴다 (--network host).
# 이때는 포트를 연결(-p)할 수 없어서 앱이 APP_PORT로 직접 연다.
echo "▶ DB 접속 확인"
if db_reachable "도커 네트워크"; then
  DB_NET=""
  APP_NET="-p $APP_PORT:3000"
elif db_reachable "서버 네트워크(--network host)" --network host; then
  DB_NET="--network host"
  APP_NET="--network host -e PORT=$APP_PORT"
else
  echo "✘ 서버에서 DB에 접속할 수 없어요. 확인한 것:"
  db_host="$(sed -n 's|^DATABASE_URL=.*@\([^:/?]*\).*|\1|p' .env)"
  db_port="$(sed -n 's|^DATABASE_URL=.*@[^:/?]*:\([0-9]*\).*|\1|p' .env)"
  db_ip="$(getent ahostsv4 "$db_host" 2>/dev/null | awk 'NR == 1 { print $1 }' || true)"
  echo "  서버가 찾은 DB 주소: ${db_ip:-못 찾음}"
  if timeout 8 bash -c "exec 3<>/dev/tcp/$db_host/$db_port" 2>/dev/null; then
    echo "  서버에서 직접 접속: OK"
  else
    echo "  서버에서 직접 접속: 실패"
  fi
  if [ -n "$db_ip" ] && command -v ip >/dev/null; then echo "  경로: $(ip route get "$db_ip" 2>&1 | head -n 1)"; fi
  echo "  도커: $(docker info -f '{{.ServerVersion}} {{json .SecurityOptions}}' 2>&1 | head -n 1)"
  exit 1
fi

echo "▶ DB 준비 (표 만들기 → 기본 아이템 → 관리자). 이미 된 것은 건너뛴다"
# shellcheck disable=SC2086 # DB_NET·APP_NET은 옵션 여러 개라 일부러 따옴표 없이 펼친다
docker run --rm --env-file .env $DB_NET "$IMAGE" \
  sh -c "npm run -s db:migrate:deploy && npm run -s db:seed && npm run -s admin:create"

echo "▶ 앱 다시 띄우기 (포트 $APP_PORT)"
mkdir -p uploads
docker rm -f "$NAME" >/dev/null 2>&1 || true
# shellcheck disable=SC2086
docker run -d --name "$NAME" --restart unless-stopped \
  --env-file .env $APP_NET \
  -v "$DIR/uploads:/app/storage/uploads" \
  "$IMAGE" >/dev/null

# 공용 서버라 docker image prune(다른 계정 이미지까지 지움) 대신 내 옛 이미지만 지운다
NEW_IMAGE="$(docker image inspect -f '{{.Id}}' "$IMAGE")"
if [ -n "$OLD_IMAGE" ] && [ "$OLD_IMAGE" != "$NEW_IMAGE" ]; then
  docker rmi "$OLD_IMAGE" >/dev/null 2>&1 || true
fi

# 첫 화면 응답 코드 (응답이 없으면 000)
app_status() {
  if command -v curl >/dev/null; then
    curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$APP_PORT/" || true
  elif timeout 5 bash -c "exec 3<>/dev/tcp/127.0.0.1/$APP_PORT" 2>/dev/null; then
    echo 200
  else
    echo 000
  fi
}

echo "▶ 앱 응답 기다리기"
code=000
for _ in $(seq 1 30); do
  sleep 2
  code="$(app_status)"
  if [ "$code" != 000 ]; then break; fi
done
if [ "$code" != 000 ] && [ "$code" -lt 500 ]; then
  echo "✔ 배포 완료: 서버의 $APP_PORT 포트에서 실행 중 (첫 화면 응답 $code)"
else
  echo "✘ 앱이 제대로 응답하지 않아요 (응답 $code). 마지막 로그:"
  docker logs --tail 50 "$NAME"
  exit 1
fi
