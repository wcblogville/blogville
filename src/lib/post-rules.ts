// 글 입력 규칙 (POST-01~04 / FR-006, FR-009, FR-018, FR-041, research R11·R12·R20).
// 브라우저(발행 전 사전 검사)와 서버(savePost)가 같은 규칙과 같은 문구를 쓴다
import { z } from "zod";
import { parseId } from "@/lib/ids";

export const POST_ERRORS = {
  bad: "잘못된 요청이에요",
  titleEmpty: "제목을 적어 주세요",
  titleLong: "제목은 100자까지예요",
  tooLong: "글이 너무 길어요",
  tagsLong: "태그는 모두 합쳐 300자까지예요",
  contentEmpty: "본문을 적어 주세요",
} as const;

export const TITLE_MAX = 100;
/** 본문 HTML 최대 길이 (UTF-16 단위, FR-006) */
export const CONTENT_HTML_MAX = 200_000;
export const TAGS_MAX = 300;
/** Server Action 요청 본문 상한(1MB)보다 작게: 넘으면 브라우저가 요청을 보내지 않고 검사 문구를 보인다 (R11) */
export const CONTENT_BYTES_MAX = 900_000;

/** 빈 값이거나 숫자만 적힌 1~2147483647 (parseId). 빈 값은 undefined */
const optionalId = z.string().refine((v) => v === "" || parseId(v) !== null, POST_ERRORS.bad);

/**
 * 검사 순서 = 문구 순서 (contracts/write-actions.md §2 표 1~7). 첫 오류 하나만 보인다.
 * 각 값은 FormData에서 꺼낸 글자 그대로 받는다
 */
export const postInputSchema = z.object({
  postId: optionalId,
  title: z.string().trim().min(1, POST_ERRORS.titleEmpty).max(TITLE_MAX, POST_ERRORS.titleLong),
  contentHtml: z.string().max(CONTENT_HTML_MAX, POST_ERRORS.tooLong),
  categoryId: optionalId,
  subcategoryId: optionalId,
  tags: z.string().max(TAGS_MAX, POST_ERRORS.tagsLong),
  visibility: z.enum(["public", "private"], POST_ERRORS.bad),
});

export type PostInputRaw = Record<keyof z.input<typeof postInputSchema>, string>;

export type PostInput = {
  postId: number | null;
  title: string;
  contentHtml: string;
  categoryId: number | null;
  subcategoryId: number | null;
  tags: string;
  visibility: "public" | "private";
};

/** 검사해서 첫 오류 문구 또는 정리된 값 */
export function checkPostInput(raw: PostInputRaw): { error: string } | { value: PostInput } {
  // zod는 키 순서대로 검사하지만 한 칸에 오류가 여러 개일 수 있어, 칸 순서로 첫 오류를 고른다
  const parsed = postInputSchema.safeParse(raw);
  if (!parsed.success) {
    const order = Object.keys(postInputSchema.shape);
    const first = [...parsed.error.issues].sort((a, b) => order.indexOf(String(a.path[0])) - order.indexOf(String(b.path[0])))[0];
    return { error: first.message };
  }
  const v = parsed.data;
  return {
    value: {
      postId: parseId(v.postId),
      title: v.title,
      contentHtml: v.contentHtml,
      categoryId: parseId(v.categoryId),
      subcategoryId: parseId(v.subcategoryId),
      tags: v.tags,
      visibility: v.visibility,
    },
  };
}

/** FormData → 검사할 글자들 (없는 칸은 빈 글자, 공개 설정은 기본 public) */
export function rawPostInput(formData: FormData): PostInputRaw {
  const get = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };
  return {
    postId: get("postId"),
    title: get("title"),
    contentHtml: get("contentHtml"),
    categoryId: get("categoryId"),
    subcategoryId: get("subcategoryId"),
    tags: get("tags"),
    visibility: formData.has("visibility") ? get("visibility") : "public",
  };
}

/** 본문 HTML의 UTF-8 크기가 요청 상한 여유(900,000바이트)를 넘는가 (R11) */
export function isContentTooLarge(html: string): boolean {
  return new TextEncoder().encode(html).length > CONTENT_BYTES_MAX;
}

/**
 * 태그 칸 → 태그 이름들 (POST-04 / FR-041, R20).
 * 쉼표·#·줄바꿈으로 나눈다(공백은 구분자가 아님). 앞뒤 공백 제거, 가운데 공백 한 칸, 영문 소문자.
 * 빈 것과 20자 넘는 것은 버리고, 중복은 먼저 적은 것을 남기며, 앞 10개만
 */
export function parseTags(raw: string): string[] {
  const names = raw
    .split(/[,#\n]/)
    .map((t) => t.trim().replace(/\s+/g, " ").toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 20);
  return [...new Set(names)].slice(0, 10);
}
