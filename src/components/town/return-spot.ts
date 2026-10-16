// 광장에서 블로그·상점 등으로 들어갔다가 나오면 들어간 자리에 다시 선다 (사용자 요청 2026-10-16).
// 광장을 떠날 때 발 위치를 이 탭(sessionStorage)에만 적고, 같은 마을 주소로 돌아오면 그 자리에서 시작한다
const KEY = "bv:town-return";
/** 이보다 오래된 자리는 쓰지 않는다 (다음 날 다시 오면 광장 아래쪽에서 시작) */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

type Saved = { path: string; x: number; y: number; at: number };

function read(): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Saved | null;
    if (!v || typeof v.x !== "number" || typeof v.y !== "number" || typeof v.path !== "string") return null;
    return Date.now() - v.at < MAX_AGE_MS ? v : null;
  } catch {
    return null;
  }
}

export function saveReturnSpot(path: string, x: number, y: number) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, x: Math.round(x), y: Math.round(y), at: Date.now() } satisfies Saved));
  } catch {
    // 저장할 수 없는 브라우저(사생활 보호 모드 등)는 광장 아래쪽에서 시작한다
  }
}

/** 이 마을 주소(/town, /town/친구)에서 떠난 자리 */
export function readReturnSpot(path: string): { x: number; y: number } | null {
  const v = read();
  return v && v.path === path ? { x: v.x, y: v.y } : null;
}

/** 나가기 버튼이 돌아갈 마을 주소 (친구 마을에서 들어갔으면 그 친구 마을) */
export function returnTownPath(): string {
  return read()?.path ?? "/town";
}
