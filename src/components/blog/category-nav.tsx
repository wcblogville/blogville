// 블로그 홈 카테고리 트리 (BLOG-05 / FR-040·057·059, contracts/blog-home.md 1.1·1.2)
// `전체 글 (N)`(공개 글 수) 아래 대분류 순서대로, 소분류는 `└ 이름 (N)`으로 들여 쓴다. 글 없는 카테고리도 (0).
// 링크는 ?category= / ?sub= 만 남기고 q·page를 버린다 (검색 모드에서 누르면 검색을 벗어나 1페이지).
// 소분류 글 수는 posts.subcategory_id로 센다 (POST-03).
import Link from "next/link";

type Sub = { id: number; name: string; postCount: number | null };
type Cat = { id: number; name: string; postCount: number; subcategories: Sub[] };

/** selected: 고른 줄 (검색 모드·없는 번호면 null → 선택 표시 없음, `전체 글`은 아무것도 고르지 않았을 때만) */
export function CategoryNav({
  base,
  tree,
  publicCount,
  selected,
}: {
  base: string;
  tree: Cat[];
  publicCount: number;
  selected: { kind: "all" } | { kind: "category"; id: number } | { kind: "sub"; id: number } | null;
}) {
  const line = (on: boolean) => `flex min-h-11 items-center gap-1 rounded-lg px-2 ${on ? "bg-[#fff3d6] font-bold" : "hover:bg-cream"}`;
  return (
    <nav className="card p-4" aria-label="카테고리">
      <h2 className="mb-2 font-display text-lg">카테고리</h2>
      {/* 카테고리 링크는 누르는 영역 44px 이상 (FR-059, research R-24) */}
      <ul className="space-y-0.5 text-sm">
        <li>
          <Link href={base} className={line(selected?.kind === "all")} aria-current={selected?.kind === "all" ? "page" : undefined}>
            전체 글 <span className="text-ink-soft">({publicCount})</span>
          </Link>
        </li>
        {tree.map((c) => {
          const on = selected?.kind === "category" && selected.id === c.id;
          return (
            <li key={c.id}>
              <Link href={`${base}?category=${c.id}`} className={line(on)} aria-current={on ? "page" : undefined}>
                <span className="min-w-0 break-words">{c.name}</span> <span className="text-ink-soft">({c.postCount})</span>
              </Link>
              {c.subcategories.length > 0 && (
                <ul className="space-y-0.5">
                  {c.subcategories.map((s) => {
                    const subOn = selected?.kind === "sub" && selected.id === s.id;
                    return (
                      <li key={s.id}>
                        <Link href={`${base}?sub=${s.id}`} className={`${line(subOn)} pl-4`} aria-current={subOn ? "page" : undefined}>
                          <span className="min-w-0 break-words">└ {s.name}</span>
                          {s.postCount !== null && <span className="text-ink-soft">({s.postCount})</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
