// 소셜 서비스 목록과 화면 이름 (AUTH-01, AUTH-05 / FR-030, FR-036). 서버·클라이언트 모두에서 쓴다
export const SOCIAL_PROVIDERS = ["kakao", "naver", "google"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const isSocialProvider = (v: unknown): v is SocialProvider => SOCIAL_PROVIDERS.includes(v as SocialProvider);

/** 화면에 쓰는 서비스 이름 (첫 화면 버튼 FR-030과 같게) */
export const SOCIAL_LABEL: Record<SocialProvider, string> = { kakao: "카카오", naver: "네이버", google: "Google" };

/** 서비스마다 키(Client ID·Secret)가 준비됐는지. 키가 없는 서비스의 버튼은 비활성 (FR-031) */
export type SocialReady = Record<SocialProvider, boolean>;

// ===== 댓글·답글 규칙 (SOC-01, SOC-02). DB 없는 순수 함수라 서버·화면·단위 테스트에서 함께 쓴다 =====
export const COMMENT_MAX = 1000;

export const SOCIAL_ERRORS = {
  empty: "댓글을 적어 주세요",
  tooLong: "댓글은 1000자까지예요",
  badRequest: "잘못된 요청이에요",
  postNotFound: "글을 찾을 수 없어요",
  noComment: "답글을 달 댓글이 없어요",
  deletedComment: "삭제된 댓글에는 답글을 달 수 없어요",
} as const;

/** 줄바꿈을 \n으로 맞추고 앞뒤 공백을 지운다 (FR-007) */
export function normalizeComment(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";
}

/**
 * 댓글·답글 내용 검사. 통과하면 정규화한 내용, 아니면 문구 (FR-008).
 * 글자 수는 DB의 char_length와 같게 코드 포인트로 센다 (이모지 1개 = 1자)
 */
export function checkComment(raw: unknown): { ok: true; content: string } | { ok: false; error: string } {
  const content = normalizeComment(raw);
  if (!content) return { ok: false, error: SOCIAL_ERRORS.empty };
  if ([...content].length > COMMENT_MAX) return { ok: false, error: SOCIAL_ERRORS.tooLong };
  return { ok: true, content };
}

/** 댓글·답글을 지울 수 있는 사람: 작성자, 그 글의 블로그 주인, 관리자 (FR-013, FR-024) */
export function canDeleteComment(opts: {
  viewerId: string | null;
  isAdmin: boolean;
  authorId: string | null;
  blogOwnerId: string;
}): boolean {
  if (!opts.viewerId) return false;
  return opts.isAdmin || opts.viewerId === opts.authorId || opts.viewerId === opts.blogOwnerId;
}

// ===== 이웃 새 글 (SOC-04) =====
/** 즐겨찾는 이웃의 글을 맨 위로 올리는 기간: 오늘을 포함한 한국 날짜 7일 (FR-042, research R11) */
export const FAVORITE_WINDOW_DAYS = 7;

/** 그 기간의 시작 날짜 (YYYY-MM-DD). todayKST는 한국 날짜 */
export function favoriteWindowStart(todayKST: string): string {
  const d = new Date(`${todayKST}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (FAVORITE_WINDOW_DAYS - 1));
  return d.toISOString().slice(0, 10);
}
