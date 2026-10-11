// 이웃 집 자리 (TOWN-18, 사용자 요청 2026-10-11 "집 위치도 즐겨찾기 한 사람중에 위치 선택해서 둘 수 있게").
// 마을의 1~10번 집 자리에 즐겨찾기 이웃을 둔다. 회원이 골라 준 자리(follows.town_lot)가 먼저이고,
// 안 고른 이웃은 남은 자리를 작은 번호부터 차례로(즐겨찾기한 순서) 받는다. 서버·화면이 같이 쓰는 순수 함수.

/** 이웃 집 자리 수 (0번은 내 집) */
export const NEIGHBOR_LOTS = 10;

/** 이웃 집 자리 번호가 맞는가 (1~10 정수) */
export function isNeighborLot(lot: unknown): lot is number {
  return typeof lot === "number" && Number.isInteger(lot) && lot >= 1 && lot <= NEIGHBOR_LOTS;
}

/**
 * 자리 나누기: rows는 즐겨찾기한 순서. 고른 자리(townLot)가 맞고 겹치지 않으면 그 자리, 아니면 남은 자리를 차례로.
 * 자리보다 이웃이 많으면 남는 이웃은 빠진다 (즐겨찾기는 10명까지라 보통 없다)
 */
export function assignLots<T extends { townLot: number | null }>(rows: readonly T[]): (T & { lot: number })[] {
  const taken = new Set<number>();
  const chosen = new Map<T, number>();
  for (const r of rows) {
    if (isNeighborLot(r.townLot) && !taken.has(r.townLot)) {
      taken.add(r.townLot);
      chosen.set(r, r.townLot);
    }
  }
  const free = Array.from({ length: NEIGHBOR_LOTS }, (_, i) => i + 1).filter((n) => !taken.has(n));
  const out: (T & { lot: number })[] = [];
  for (const r of rows) {
    const lot = chosen.get(r) ?? free.shift();
    if (lot !== undefined) out.push({ ...r, lot });
  }
  return out.sort((a, b) => a.lot - b.lot);
}
