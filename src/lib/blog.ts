// 블로그 순수 규칙 (BLOG-01~05 / FR-009, FR-016~FR-020, FR-039~FR-040, FR-051~FR-053)
// DB를 쓰지 않는 순수 함수만 둔다: 화면·서버·테스트(scripts/test-blog.ts) 어디서나 import 할 수 있다.
// 이름 정규화·예약어는 auth 모듈 src/lib/names.ts(normalizeName, isReservedName, RESERVED_NAMES)를 쓴다 (research R-02).
// 예약어 16개의 값은 blog FR-009가 정하고 그 모듈에 들어 있다.

/** 블로그 주소 형식: 영문 소문자·숫자·_ 3~20자 (DB CHECK blogs_slug_check와 같다, FR-009) */
export const SLUG_RE = /^[a-z0-9_]{3,20}$/;

/** 블로그 이름·소개·카테고리·검색어 길이 (FR-016, FR-033, FR-053) */
export const BLOG_TITLE_MAX = 40;
export const BLOG_DESCRIPTION_MAX = 160;
export const SEARCH_QUERY_MAX = 50;

/**
 * 글자 수: 앞뒤 공백을 지운 뒤 코드 포인트 수 (research R-07).
 * DB CHECK의 char_length와 같은 단위라 이모지 하나는 1자다 (JS length는 2).
 */
export function charCount(s: string): number {
  return [...s.trim()].length;
}

/**
 * 가입 때 만드는 블로그 기본값 (BLOG-01 / FR-001·002, research R-27).
 * 가입 트랜잭션(src/server/signup.ts createMember, auth)이 이 값을 쓴다.
 * 아이디 형식(4~20자)은 주소 형식(3~20자) 안에 들고, 이름은 최대 25자라 DB CHECK를 늘 만족한다.
 */
export function defaultBlogFor(username: string) {
  return {
    slug: username,
    title: `${username}의 블로그`,
    description: "",
    backgroundCode: "bg_meadow", // 초원
    categoryName: "일상",
  } as const;
}

/** ILIKE 패턴: \ % _ 를 글자 그대로 찾도록 이스케이프하고 앞뒤에 % (ESCAPE '\' 와 함께 쓴다, FR-051) */
export function toLikePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export type SearchQuery = { empty: true; q: "" } | { empty: false; q: string };

/**
 * 주소의 ?q= 값 (FR-053, research R-17).
 * 없음 → null(검색 아님), 앞뒤 공백 제거 뒤 0자 → 빈 검색어, 51자 이상 → null(무시), 1~50자 → 검색어.
 */
export function parseSearchQuery(raw: unknown): SearchQuery | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const q = value.trim();
  if (!q) return { empty: true, q: "" };
  if ([...q].length > SEARCH_QUERY_MAX) return null;
  return { empty: false, q };
}

type Ordered = { id: number; position: number };
const byPosition = (a: Ordered, b: Ordered) => a.position - b.position || a.id - b.id;

/**
 * 카테고리 트리 (FR-040, research R-14): 대분류·소분류 모두 position → id 순,
 * 소분류는 categoryId로 제 대분류 아래에 묶는다. 대분류가 없는 소분류는 버린다.
 */
export function buildCategoryTree<C extends Ordered, S extends Ordered & { categoryId: number }>(
  categories: C[],
  subcategories: S[],
): (C & { subcategories: S[] })[] {
  const byCategory = new Map<number, S[]>();
  for (const s of [...subcategories].sort(byPosition)) {
    const list = byCategory.get(s.categoryId);
    if (list) list.push(s);
    else byCategory.set(s.categoryId, [s]);
  }
  return [...categories].sort(byPosition).map((c) => ({ ...c, subcategories: byCategory.get(c.id) ?? [] }));
}

/**
 * 순서 맞바꾸기 (FR-039, research R-12). ids는 지금 순서(position, id)대로.
 * id를 바로 위(-1)·아래(1)와 맞바꾸고 0부터 다시 매긴다. 끝이거나 없는 id·이상한 방향이면 순서는 그대로.
 */
export function swapPosition(ids: number[], id: number, direction: unknown): { id: number; position: number }[] {
  const list = [...ids];
  const i = list.indexOf(id);
  if (i >= 0 && (direction === -1 || direction === 1)) {
    const j = i + direction;
    if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  }
  return list.map((x, position) => ({ id: x, position }));
}

/**
 * 집 지붕 색 코드값 10개 (TOWN-07). 집 단계(10단계)마다 하나씩 열린다 (src/lib/house.ts, 사용자 결정 2026-10-09).
 * 실제 색(hex)은 src/lib/art/town.ts ROOF_HEX. DB CHECK blogs_roof_color_check와 같게 둔다
 */
export const ROOF_COLORS = ["red", "orange", "yellow", "green", "sky", "blue", "purple", "brown", "pink", "mint"] as const;
export type RoofColor = (typeof ROOF_COLORS)[number];

export function isRoofColor(value: unknown): value is RoofColor {
  return typeof value === "string" && (ROOF_COLORS as readonly string[]).includes(value);
}
