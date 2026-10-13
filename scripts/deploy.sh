#!/usr/bin/env bash
# 서버에서 실행하는 배포 스크립트. GitHub Actions가 SSH로 접속해 부른다 (.github/workflows/deploy.yml).
# 같은 폴더에 blogville.tar.gz(앱 이미지), blogville-proxy.tar.gz(nginx 이미지),
# .env(접속 정보, 워크플로가 SSH에서 만든다)가 있어야 한다.
#   APP_PORT=8420 bash scripts/deploy.sh            # 배포
#   APP_PORT=8420 bash scripts/deploy.sh rollback   # 바로 전 버전으로 되돌리기
#
# 무중단 배포(블루-그린): 손님 → 강사님 nginx(고치지 않음) → 우리 nginx 컨테이너(APP_PORT 8420)
#   → 파랑 앱(8421) 또는 초록 앱(8422). 새 버전은 꺼져 있는 색에 띄워 응답을 확인한 뒤
#   우리 nginx의 연결 대상만 바꾸고(reload, 진행 중인 요청은 끊지 않음) 옛 색을 끈다.
#   새 앱이 응답하지 않으면 옛 앱이 그대로 손님을 받는다.
# 지금 켜진 색: cat ~/blogville/proxy/active
set -euo pipefail

MODE="${1:-deploy}"
case "$MODE" in deploy | rollback) ;; *)
  echo "사용법: APP_PORT=8420 bash scripts/deploy.sh [rollback]"
  exit 2
  ;;
esac

APP_PORT="${APP_PORT:?APP_PORT(내 포트 번호)가 필요해요}"
BLUE_PORT="${BLUE_PORT:-$((APP_PORT + 1))}"
GREEN_PORT="${GREEN_PORT:-$((APP_PORT + 2))}"
IMAGE="${IMAGE:-blogville:latest}"
PREVIOUS_IMAGE="${IMAGE%%:*}:previous" # 되돌리기용으로 남겨 두는 바로 전 버전
PROXY_IMAGE="${PROXY_IMAGE:-nginx:1.27.5-alpine}" # deploy.yml의 PROXY_IMAGE와 같게
LEGACY=blogville                                    # 무중단 배포 전, 8420을 직접 쓰던 앱 컨테이너
PROXY=blogville-proxy
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}" # 새 앱이 응답할 때까지 기다리는 최대 초
DRAIN_SECONDS="${DRAIN_SECONDS:-10}"   # 전환 뒤 옛 앱이 하던 요청을 마칠 때까지 기다리는 초
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
chmod 700 "$DIR" # 공용 서버라 다른 계정이 .env·.secrets·첨부를 못 보게
PROXY_DIR="$DIR/proxy"
mkdir -p "$PROXY_DIR" uploads

# 배포와 되돌리기가 겹쳐 돌지 않게
if command -v flock >/dev/null; then
  exec 9>"$DIR/.deploy.lock"
  flock -n 9 || { echo "✘ 다른 배포가 진행 중이에요. 끝난 뒤 다시 실행해 주세요."; exit 1; }
fi

color_name() { if [ "$1" = blue ]; then echo 파랑; else echo 초록; fi; }
color_port() { if [ "$1" = blue ]; then echo "$BLUE_PORT"; else echo "$GREEN_PORT"; fi; }
other_color() { if [ "$1" = blue ]; then echo green; else echo blue; fi; }
container_running() { [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = true ]; }
container_exists() { docker inspect "$1" >/dev/null 2>&1; }
image_id() { docker image inspect -f '{{.Id}}' "$1" 2>/dev/null || true; }
container_image() { docker inspect -f '{{.Image}}' "$1" 2>/dev/null || true; }

# 그 포트를 누가 듣고 있는지 (ss가 있으면 ss, 없으면 접속해 본다)
port_in_use() {
  if command -v ss >/dev/null; then
    ss -Hltn 2>/dev/null | awk '{ print $4 }' | grep -qE "[:.]$1\$"
  else
    timeout 2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$1" 2>/dev/null
  fi
}

# 첫 화면 응답 코드 (응답이 없으면 000). 인자: 포트
http_status() {
  if command -v curl >/dev/null; then
    curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 5 "http://127.0.0.1:$1/" 2>/dev/null || true
  elif timeout 5 bash -c "exec 3<>/dev/tcp/127.0.0.1/$1" 2>/dev/null; then
    echo 200
  else
    echo 000
  fi
}
status_ok() { [ "$1" != 000 ] && [ "$1" -lt 500 ] 2>/dev/null; }

# ---------------------------------------------------------------------------
# 비밀 값: BETTER_AUTH_SECRET·관리자 아이디·비밀번호가 GitHub secrets에 없으면 서버에서 한 번 만들어
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

# 내가 불러온 앱 이미지 ID 목록 (공용 서버라 docker image prune 대신 이 목록에 있는 것만 지운다)
remember_image() { if [ -n "$1" ]; then echo "$1" >> .images; fi; }

echo "▶ 이미지 불러오기"
if [ "$MODE" = deploy ]; then
  remember_image "$(image_id "$IMAGE")"
  gunzip -c blogville.tar.gz | docker load
  rm -f blogville.tar.gz
  remember_image "$(image_id "$IMAGE")"
  APP_IMAGE="$IMAGE"
else
  APP_IMAGE="$PREVIOUS_IMAGE"
  echo "  되돌리기: 바로 전 버전($PREVIOUS_IMAGE)을 다시 띄웁니다 (DB는 그대로)"
  if [ -z "$(image_id "$APP_IMAGE")" ]; then
    echo "✘ 되돌릴 이전 버전($APP_IMAGE)이 없어요. 되돌리기는 무중단 배포를 한 번 이상 한 뒤에 쓸 수 있어요."
    exit 1
  fi
fi
# 우리 nginx 이미지: 서버가 Docker Hub에서 못 받을 수 있어 워크플로가 파일로 보낸다. 없을 때만 불러온다
if [ -z "$(image_id "$PROXY_IMAGE")" ]; then
  if [ -f blogville-proxy.tar.gz ]; then
    gunzip -c blogville-proxy.tar.gz | docker load
  else
    docker pull "$PROXY_IMAGE" || { echo "✘ nginx 이미지($PROXY_IMAGE)가 없어요"; exit 1; }
  fi
fi
rm -f blogville-proxy.tar.gz
[ -n "$(image_id "$PROXY_IMAGE")" ] || { echo "✘ nginx 이미지($PROXY_IMAGE)를 불러오지 못했어요"; exit 1; }

# ---------------------------------------------------------------------------
# 지금 상태 알아보기
#   ACTIVE: 지금 손님을 받는 색 (없으면 빈칸)
#   PROXY_UP: 우리 nginx가 떠 있는지
#   LEGACY_UP: 무중단 배포 전의 옛 앱(blogville)이 떠 있는지 → 처음 한 번 전환
ACTIVE=""
saved="$(cat "$PROXY_DIR/active" 2>/dev/null || true)"
if { [ "$saved" = blue ] || [ "$saved" = green ]; } && container_running "blogville-$saved"; then
  ACTIVE="$saved"
elif container_running blogville-blue; then
  ACTIVE=blue
elif container_running blogville-green; then
  ACTIVE=green
fi
PROXY_UP=0
container_running "$PROXY" && PROXY_UP=1
LEGACY_UP=0
container_running "$LEGACY" && LEGACY_UP=1

if [ "$MODE" = rollback ] && { [ -z "$ACTIVE" ] || [ "$PROXY_UP" = 0 ]; }; then
  echo "✘ 지금 켜진 색이 없거나 우리 nginx가 꺼져 있어 되돌릴 수 없어요. 그냥 다시 배포해 주세요."
  exit 1
fi

if [ -n "$ACTIVE" ]; then TARGET="$(other_color "$ACTIVE")"; else TARGET=blue; fi
TARGET_NAME="blogville-$TARGET"
TARGET_PORT="$(color_port "$TARGET")"
OLD_NAME=""
OLD_LABEL="없음"
OLD_SERVING="아직 켜진 앱이 없어요"
if [ -n "$ACTIVE" ]; then
  OLD_NAME="blogville-$ACTIVE"
  OLD_LABEL="$(color_name "$ACTIVE")"
  OLD_SERVING="손님은 그대로 $OLD_LABEL 앱이 받고 있어요"
elif [ "$LEGACY_UP" = 1 ]; then
  OLD_NAME="$LEGACY"
  OLD_LABEL="옛 앱"
  OLD_SERVING="손님은 그대로 옛 앱($LEGACY)이 받아요"
fi
ACTIVE_LABEL=없음
if [ -n "$ACTIVE" ]; then ACTIVE_LABEL="$(color_name "$ACTIVE") $(color_port "$ACTIVE")"; fi
echo "▶ 지금 상태: 켜진 색 $ACTIVE_LABEL, 우리 nginx $([ "$PROXY_UP" = 1 ] && echo 켜짐 || echo 꺼짐)$([ "$LEGACY_UP" = 1 ] && echo ", 옛 앱($LEGACY) 켜짐" || true)"

# 앱이 꺼져 있었다면 왜 꺼졌는지 남긴다 (2026-10-13 배포 사이에 앱이 두 번 꺼져 502가 났다).
# 아래에서 쉬는 색 컨테이너를 지우기 전에 본다
if [ -z "$ACTIVE" ] && [ "$LEGACY_UP" = 0 ]; then
  echo "▶ 꺼진 앱 살펴보기"
  for name in blogville-blue blogville-green "$LEGACY"; do
    if container_exists "$name"; then
      echo "  $name: $(docker inspect -f '상태 {{.State.Status}}, 종료 코드 {{.State.ExitCode}}, 메모리 부족 {{.State.OOMKilled}}, 재시작 {{.RestartCount}}번, 꺼진 시각 {{.State.FinishedAt}} {{.State.Error}}' "$name")"
      docker logs --tail 20 "$name" 2>&1 | sed 's/^/    /' || true
    else
      echo "  $name: 컨테이너가 없어요 (누가 지웠거나 서버가 정리했을 수 있어요)"
    fi
  done
  echo "  서버 켜진 시각: $(uptime -s 2>/dev/null || echo 알 수 없음)"
fi

# 쉬는 색 포트가 비어 있는지 (공용 서버라 다른 계정이 쓰고 있을 수 있다). DB를 건드리기 전에 본다
docker rm -f "$TARGET_NAME" >/dev/null 2>&1 || true # 지난번 실패로 남은 것
if port_in_use "$TARGET_PORT"; then
  echo "✘ $TARGET_PORT 포트를 이미 다른 프로그램(다른 계정일 수 있어요)이 쓰고 있어요."
  echo "  BLUE_PORT·GREEN_PORT를 비어 있는 포트로 정해 다시 실행해 주세요."
  exit 1
fi

# ---------------------------------------------------------------------------
# 앱 네트워크: 도커 기본 네트워크에서 DB에 못 가면 서버의 네트워크를 그대로 쓴다 (--network host).
# 이때는 포트를 연결(-p)할 수 없어서 앱이 자기 색 포트(PORT)로 직접 연다. 고른 방식은 proxy/net에 적어 둔다 (확인용).
db_reachable() { # 인자: 이름표, docker run 옵션 (예: --network host)
  local label="$1"
  shift
  docker run --rm --env-file .env "$@" "$APP_IMAGE" node -e '
    const label = process.argv[1], u = new URL(process.env.DATABASE_URL);
    const s = require("node:net").connect({ host: u.hostname, port: Number(u.port || 5432), timeout: 8000 });
    s.on("connect", () => { console.log(`  ${label}: 접속 OK`); process.exit(0); });
    s.on("timeout", () => { console.log(`  ${label}: 시간 초과`); process.exit(1); });
    s.on("error", (e) => { console.log(`  ${label}: ${e.code} ${e.address || ""}`); process.exit(1); });' "$label"
}

echo "▶ DB 접속 확인"
if db_reachable "도커 네트워크"; then
  NET_MODE=bridge
elif db_reachable "서버 네트워크(--network host)" --network host; then
  NET_MODE=host
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
DB_NET=""
if [ "$NET_MODE" = host ]; then DB_NET="--network host"; fi
echo "$NET_MODE" > "$PROXY_DIR/net"

if [ "$MODE" = deploy ]; then
  echo "▶ DB 준비 (표 만들기 → 기본 아이템 → 관리자). 이미 된 것은 건너뛴다"
  # 옛 앱이 아직 손님을 받는 중이라, 마이그레이션은 옛 앱도 버틸 수 있어야 한다
  # (칸·표는 추가만, 이름 바꾸기·삭제는 다음 배포에서. docs: server-deploy.md "추가 먼저, 삭제는 다음 배포")
  # shellcheck disable=SC2086 # DB_NET은 옵션 여러 개라 일부러 따옴표 없이 펼친다
  docker run --rm --env-file .env $DB_NET "$APP_IMAGE" \
    sh -c "npm run -s db:migrate:deploy && npm run -s db:seed && npm run -s admin:create"
fi

# ---------------------------------------------------------------------------
# 우리 nginx 설정. proxy 폴더를 통째로 읽기 전용으로 마운트한다
# (파일 하나만 마운트하면 mv로 바꾼 새 파일이 컨테이너에 안 보인다).
write_file() { # 인자: 파일 경로. 내용은 표준 입력. 임시 파일에 쓰고 mv로 한 번에 바꾼다
  cat > "$1.tmp"
  mv -f "$1.tmp" "$1"
}
write_nginx_conf() {
  write_file "$PROXY_DIR/nginx.conf" <<EOF
# scripts/deploy.sh가 만든다 (고치면 다음 배포 때 덮어써짐)
worker_processes 1;
pid /tmp/nginx.pid;
error_log /dev/stderr warn;
events { worker_connections 1024; }
http {
  access_log off;
  server_tokens off;
  # 첨부 파일은 30MB까지라 여유를 둔다 (src/lib/attachments.ts FILE_MAX_BYTES)
  client_max_body_size 40m;
  proxy_connect_timeout 5s;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;

  # 강사님 nginx가 붙여 보낸 값은 그대로 넘기고, 없으면 우리가 채운다
  map \$http_upgrade \$connection_upgrade { default upgrade; '' ''; }
  map \$http_x_forwarded_proto \$fwd_proto { default \$http_x_forwarded_proto; '' \$scheme; }
  map \$http_x_forwarded_host \$fwd_host { default \$http_x_forwarded_host; '' \$http_host; }
  map \$http_x_real_ip \$real_ip { default \$http_x_real_ip; '' \$remote_addr; }

  include /etc/nginx/blogville/upstream.conf;

  server {
    listen $APP_PORT;
    location / {
      proxy_pass http://blogville_app;
      proxy_http_version 1.1;
      proxy_set_header Host \$http_host;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$fwd_proto;
      proxy_set_header X-Forwarded-Host \$fwd_host;
      proxy_set_header X-Real-IP \$real_ip;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection \$connection_upgrade;
    }
  }
}
EOF
}
write_upstream() { # 인자: 색
  write_file "$PROXY_DIR/upstream.conf" <<EOF
# 지금 손님을 받는 색: $1 (scripts/deploy.sh가 바꾼다)
upstream blogville_app {
  server 127.0.0.1:$(color_port "$1");
  keepalive 16;
}
EOF
}
NGINX_C=(-c /etc/nginx/blogville/nginx.conf)
proxy_test() { docker exec "$PROXY" nginx -t -q "${NGINX_C[@]}"; }
proxy_reload() { # 성공하면 조용히, 실패하면 nginx가 한 말을 보여 준다
  local out
  out="$(docker exec "$PROXY" nginx -s reload "${NGINX_C[@]}" 2>&1)" || { echo "$out"; return 1; }
}
# 컨테이너 없이 설정 검사 (우리 nginx가 아직 없을 때)
proxy_test_offline() {
  docker run --rm --entrypoint nginx -v "$PROXY_DIR:/etc/nginx/blogville:ro" "$PROXY_IMAGE" -t -q "${NGINX_C[@]}"
}
start_proxy() {
  docker rm -f "$PROXY" >/dev/null 2>&1 || true
  docker run -d --name "$PROXY" --network host --restart unless-stopped \
    -e NGINX_ENTRYPOINT_QUIET_LOGS=1 \
    -v "$PROXY_DIR:/etc/nginx/blogville:ro" \
    "$PROXY_IMAGE" nginx "${NGINX_C[@]}" -g 'daemon off;' >/dev/null
}

# 8420으로 n번 연속 물어봐서 모두 정상이면 성공 (reload는 바로 끝나지 않아 몇 번 본다)
check_front() {
  local code="" ok=0
  for _ in $(seq 1 10); do
    code="$(http_status "$APP_PORT")"
    if status_ok "$code"; then ok=$((ok + 1)); else ok=0; fi
    if [ "$ok" -ge 3 ]; then
      FRONT_CODE="$code"
      return 0
    fi
    sleep 1
  done
  FRONT_CODE="$code"
  return 1
}

# ---------------------------------------------------------------------------
# 무중단 증명: 전환하는 동안 0.2초마다 8420에 물어보고, 응답 없음(000)·500대를 실패로 센다
PROBE_FILE="$DIR/.probe"
PROBE_PID=""
start_probe() {
  : > "$PROBE_FILE"
  (
    trap 'exit 0' TERM
    while :; do
      http_status "$APP_PORT" >> "$PROBE_FILE"
      echo >> "$PROBE_FILE"
      sleep 0.2
    done
  ) &
  PROBE_PID=$!
}
stop_probe() {
  [ -n "$PROBE_PID" ] || return 0
  kill "$PROBE_PID" 2>/dev/null || true
  wait "$PROBE_PID" 2>/dev/null || true
  PROBE_PID=""
  local total fails
  total="$(grep -c . "$PROBE_FILE" || true)"
  fails="$(grep . "$PROBE_FILE" | grep -cvE '^[1-4][0-9][0-9]$' || true)"
  echo "  전환 중 요청 ${total:-0}번, 실패 ${fails:-0}번"
  rm -f "$PROBE_FILE"
}

# 중간에 멈춰도 사이트가 죽은 채 남지 않게: 옛 앱(blogville)을 끈 뒤 우리 nginx가 뜨기 전에
# 스크립트가 끝나면 옛 앱을 다시 켠다
RESTORE_LEGACY=0
on_exit() {
  local rc=$?
  stop_probe >/dev/null 2>&1 || true
  if [ "$RESTORE_LEGACY" = 1 ]; then
    echo "  ↩ 옛 앱($LEGACY)을 다시 켭니다"
    docker rm -f "$PROXY" >/dev/null 2>&1 || true
    docker start "$LEGACY" >/dev/null 2>&1 || echo "  ✘ 옛 앱을 다시 켜지 못했어요: docker start $LEGACY"
  fi
  exit "$rc"
}
trap on_exit EXIT

fail_new_app() { # 새 앱을 지우고 실패로 끝낸다. 옛 앱과 우리 nginx는 그대로
  echo "✘ $1. 새 앱의 마지막 로그:"
  docker logs --tail 50 "$TARGET_NAME" 2>&1 || true
  docker rm -f "$TARGET_NAME" >/dev/null 2>&1 || true
  stop_probe
  echo "  $OLD_SERVING"
  exit 1
}

# ---------------------------------------------------------------------------
# 1) 새 앱을 쉬는 색 포트에 띄운다
start_probe
echo "▶ 새 앱 띄우기 ($(color_name "$TARGET"), $TARGET_PORT)"
if [ "$NET_MODE" = host ]; then
  # 서버 네트워크를 그대로 쓰므로 바깥에서 못 들어오게 127.0.0.1에서만 듣는다 (손님은 우리 nginx로만)
  APP_NET=(--network host -e "PORT=$TARGET_PORT" -e HOSTNAME=127.0.0.1)
else
  APP_NET=(-p "127.0.0.1:$TARGET_PORT:3000")
fi
docker run -d --name "$TARGET_NAME" --restart unless-stopped \
  --env-file .env "${APP_NET[@]}" \
  -v "$DIR/uploads:/app/storage/uploads" \
  "$APP_IMAGE" >/dev/null || fail_new_app "새 앱 컨테이너를 만들지 못했어요"
NEW_IMAGE="$(container_image "$TARGET_NAME")"

echo "▶ 새 앱 응답 기다리기 (최대 ${HEALTH_TIMEOUT}초)"
code=000
deadline=$((SECONDS + HEALTH_TIMEOUT))
while [ "$SECONDS" -lt "$deadline" ]; do
  sleep 2
  if ! container_running "$TARGET_NAME" || [ "$(docker inspect -f '{{.RestartCount}}' "$TARGET_NAME" 2>/dev/null || echo 0)" != 0 ]; then
    fail_new_app "새 앱이 켜지자마자 꺼졌어요"
  fi
  code="$(http_status "$TARGET_PORT")"
  if [ "$code" != 000 ]; then break; fi
done
status_ok "$code" || fail_new_app "새 앱이 제대로 응답하지 않아요 (응답 $code)"
echo "  새 앱 첫 화면 응답 $code"

# 2) 우리 nginx를 새 색으로 돌린다
write_nginx_conf
cp -f "$PROXY_DIR/upstream.conf" "$PROXY_DIR/upstream.conf.bak" 2>/dev/null || true
write_upstream "$TARGET"
restore_upstream() {
  if [ -f "$PROXY_DIR/upstream.conf.bak" ]; then mv -f "$PROXY_DIR/upstream.conf.bak" "$PROXY_DIR/upstream.conf"; fi
}

if [ "$PROXY_UP" = 1 ]; then
  echo "▶ 전환: $OLD_LABEL → $(color_name "$TARGET")"
  if ! proxy_test; then
    restore_upstream
    fail_new_app "nginx 설정 검사(nginx -t)에 실패해 전환하지 않았어요"
  fi
  proxy_reload || { restore_upstream; proxy_reload || true; fail_new_app "nginx reload에 실패했어요"; }
  if ! check_front; then
    echo "  ⚠ 전환 뒤 $APP_PORT 응답이 이상해요 (응답 $FRONT_CODE). 원래 색으로 되돌립니다"
    restore_upstream
    proxy_reload || true
    fail_new_app "전환 뒤 $APP_PORT 포트가 응답하지 않아요"
  fi
else
  # 처음 한 번 전환(또는 우리 nginx가 없어졌을 때): 8420을 우리 nginx 컨테이너가 맡게 한다
  echo "▶ 우리 nginx 준비 ($APP_PORT → $(color_name "$TARGET") $TARGET_PORT)"
  proxy_test_offline || fail_new_app "nginx 설정 검사(nginx -t)에 실패했어요"
  if [ "$LEGACY_UP" = 1 ]; then
    echo "▶ 전환: 옛 앱($LEGACY) → 우리 nginx + $(color_name "$TARGET") (처음 한 번만 몇 초 끊겨요)"
    RESTORE_LEGACY=1
    docker stop -t 20 "$LEGACY" >/dev/null # 지우지 않고 끄기만: 실패하면 다시 켠다
  fi
  docker rm -f "$PROXY" >/dev/null 2>&1 || true
  for _ in $(seq 1 10); do port_in_use "$APP_PORT" || break; sleep 1; done
  if port_in_use "$APP_PORT"; then
    fail_new_app "$APP_PORT 포트를 다른 프로그램이 쓰고 있어 우리 nginx를 띄울 수 없어요"
  fi
  start_proxy || fail_new_app "우리 nginx 컨테이너를 띄우지 못했어요"
  if ! check_front; then
    echo "  우리 nginx 로그:"
    docker logs --tail 5 "$PROXY" 2>&1 || true
    docker rm -f "$PROXY" >/dev/null 2>&1 || true
    fail_new_app "우리 nginx를 거친 $APP_PORT 응답이 이상해요 (응답 $FRONT_CODE)"
  fi
  if [ "$LEGACY_UP" = 1 ]; then
    RESTORE_LEGACY=0
    remember_image "$(container_image "$LEGACY")"
  fi
fi
echo "$TARGET" > "$PROXY_DIR/active"
rm -f "$PROXY_DIR/upstream.conf.bak"
echo "  $APP_PORT 첫 화면 응답 $FRONT_CODE ($(color_name "$TARGET") 앱)"

# 3) 옛 앱이 하던 요청을 마칠 시간을 주고 끈다
PREV_APP_IMAGE=""
if [ -n "$OLD_NAME" ]; then
  echo "▶ 옛 앱 정리 ($OLD_LABEL, ${DRAIN_SECONDS}초 기다린 뒤)"
  sleep "$DRAIN_SECONDS"
  PREV_APP_IMAGE="$(container_image "$OLD_NAME")"
  docker stop -t 30 "$OLD_NAME" >/dev/null 2>&1 || true
  docker rm -f "$OLD_NAME" >/dev/null 2>&1 || true
fi
if [ "$PROXY_UP" = 1 ]; then
  stop_probe
  echo "✔ 무중단 전환 완료: $(color_name "$TARGET") 앱($TARGET_PORT)이 $APP_PORT 포트에서 손님을 받아요"
else
  stop_probe
  echo "  (우리 nginx를 처음 띄우느라 잠깐 끊긴 것은 정상이에요. 다음 배포부터 끊기지 않아요)"
  echo "✔ 배포 완료: 우리 nginx($APP_PORT) → $(color_name "$TARGET") 앱($TARGET_PORT)"
fi

# 4) 이미지 정리: 바로 전 버전은 되돌리기용으로 PREVIOUS_IMAGE 이름표를 붙여 남기고,
#    지금 쓰는 것·바로 전 것이 아닌 내 옛 이미지만 지운다
if [ -n "$PREV_APP_IMAGE" ] && [ "$PREV_APP_IMAGE" != "$NEW_IMAGE" ]; then
  docker tag "$PREV_APP_IMAGE" "$PREVIOUS_IMAGE" 2>/dev/null || true
fi
KEEP_PREV="$(image_id "$PREVIOUS_IMAGE")"
if [ -f .images ]; then
  sort -u .images | while read -r id; do
    if [ -z "$id" ] || [ "$id" = "$NEW_IMAGE" ] || [ "$id" = "$KEEP_PREV" ] || [ "$id" = "$(image_id "$IMAGE")" ]; then continue; fi
    docker rmi "$id" >/dev/null 2>&1 || true # 다른 컨테이너가 쓰고 있으면 지워지지 않는다
  done
fi
# latest가 실패한 배포의 이미지일 수도 있어 목록에 남겨 다음 배포 때 지운다
{ echo "$NEW_IMAGE"; echo "$KEEP_PREV"; image_id "$IMAGE"; } | grep . | sort -u > .images
# 무중단 배포 전의 옛 앱 컨테이너(꺼 둔 것)는 전환이 끝났으니 지운다
if [ "$LEGACY_UP" = 1 ] || { container_exists "$LEGACY" && ! container_running "$LEGACY"; }; then
  docker rm -f "$LEGACY" >/dev/null 2>&1 || true
fi

# nginx 확인 (안내만, 배포 결과와 상관없다): ~/nginx 설정에 사이트 주소와 앱 포트가 있는지,
# 사이트 주소가 DNS에 있는지, 이 서버의 nginx가 사이트 주소 요청을 앱으로 넘기는지 찍는다
check_nginx() {
  local host ip out status title scheme port
  host="$(sed -n 's|^BETTER_AUTH_URL=[a-z]*://\([^/:]*\).*|\1|p' .env)"
  echo "▶ nginx 확인 ($host)"
  if ls "$HOME"/nginx/*.conf >/dev/null 2>&1; then
    grep -HE '^[[:space:]]*(listen|server_name|proxy_pass)[[:space:]]' "$HOME"/nginx/*.conf | sed "s|^$HOME/|  ~/|"
    grep -qE "server_name[^;]*[[:space:]]${host}[[:space:];]" "$HOME"/nginx/*.conf || echo "  ⚠ server_name에 $host 이(가) 없어요"
    grep -qE "proxy_pass[^;]*:${APP_PORT}[/;]" "$HOME"/nginx/*.conf || echo "  ⚠ proxy_pass에 $APP_PORT 포트가 없어요"
  else
    echo "  ⚠ ~/nginx/*.conf 파일이 없어요"
  fi
  ip="$(getent ahostsv4 "$host" 2>/dev/null | awk 'NR == 1 { print $1 }' || true)"
  echo "  DNS: ${ip:-등록 안 됨}"
  command -v curl >/dev/null || return 0
  for scheme in http https; do
    port=80
    if [ "$scheme" = https ]; then port=443; fi
    out="$(curl -sk --noproxy '*' --max-time 5 --resolve "$host:$port:127.0.0.1" -w '\n%{http_code}' "$scheme://$host/" 2>/dev/null || true)"
    status="${out##*$'\n'}"
    title="$(printf '%s' "$out" | grep -o '<title>[^<]*</title>' | head -n 1 || true)"
    echo "  이 서버 nginx로 $scheme 요청: ${status:-000} $title"
  done
}
check_nginx || true
