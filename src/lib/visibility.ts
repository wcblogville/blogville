// 글 공개 범위 (POST-02, 2026-10-12 사용자 요청 "이웃에게만 공개"). 브라우저·서버 공용 순수 함수.
// public = 누구나, neighbors = 주인 + 주인을 이웃 추가한 회원(follows.follower_id = 보는 사람), private = 주인만.
// 이웃 공개 글은 마을 소식 [🏘 마을 전체]·[💛 이웃 새 글](이미 이웃 글만 모이는 곳)과 그 이웃이 보는 블로그에만 나온다.
// [🌐 모든 글]·태그별 글·마을 검색·인기 태그·광장 집에는 공개 글만 나온다

export const VISIBILITIES = ["public", "neighbors", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: "🌍 공개",
  neighbors: "👥 이웃 공개",
  private: "🔒 비공개",
};

/** 목록·상세 배지. 공개 글은 배지가 없다 */
export const VISIBILITY_BADGE: Record<Visibility, string | null> = {
  public: null,
  neighbors: "👥 이웃 공개",
  private: "🔒 비공개",
};

export function isVisibility(v: unknown): v is Visibility {
  return typeof v === "string" && (VISIBILITIES as readonly string[]).includes(v);
}

/**
 * 보는 사람이 글을 볼 수 있나. 관리자 예외 없음.
 * isOwner: 로그인한 회원이 그 블로그 주인 / isNeighbor: 로그인한 회원이 주인을 이웃 추가했다
 */
export function canSeePost(visibility: Visibility, viewer: { isOwner: boolean; isNeighbor: boolean }): boolean {
  if (visibility === "public") return true;
  if (viewer.isOwner) return true;
  return visibility === "neighbors" && viewer.isNeighbor;
}

/** 블로그를 보는 사람의 자리: 주인 / 주인의 이웃 / 그 밖(다른 회원·방문자) */
export type PostAccess = "owner" | "neighbor" | "guest";

export function postAccessOf(isOwner: boolean, isNeighbor: boolean): PostAccess {
  return isOwner ? "owner" : isNeighbor ? "neighbor" : "guest";
}

/** 그 자리에서 보이는 공개 범위 (owner는 모두) */
export function visibleVisibilities(access: PostAccess): Visibility[] {
  return access === "owner" ? [...VISIBILITIES] : access === "neighbor" ? ["public", "neighbors"] : ["public"];
}
