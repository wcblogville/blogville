// 새 글 임시 저장 (POST-08 / FR-060~064, contracts/write-actions.md §6).
// 이 브라우저의 localStorage에만 둔다(서버로 보내지 않음). 회원마다 1개. 저장을 쓸 수 없으면 조용히 건너뛴다

export type Draft = {
  title: string;
  categoryId: number | null;
  subcategoryId: number | null;
  visibility: "public" | "private";
  contentHtml: string;
  tags: string;
  savedAt: string; // ISO
};

const keyOf = (userId: string) => `blogville:draft:${userId}`;

export function readDraft(userId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(keyOf(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (typeof d !== "object" || d === null) return null;
    const id = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);
    return {
      title: typeof d.title === "string" ? d.title : "",
      categoryId: id(d.categoryId),
      subcategoryId: id(d.subcategoryId),
      visibility: d.visibility === "private" ? "private" : "public",
      contentHtml: typeof d.contentHtml === "string" ? d.contentHtml : "",
      tags: typeof d.tags === "string" ? d.tags : "",
      savedAt: typeof d.savedAt === "string" ? d.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** 썼으면 true */
export function writeDraft(userId: string, draft: Draft): boolean {
  try {
    window.localStorage.setItem(keyOf(userId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(userId: string) {
  try {
    window.localStorage.removeItem(keyOf(userId));
  } catch {
    // 저장을 쓸 수 없는 브라우저
  }
}
