import Link from "next/link";

/** 페이지 번호. hrefFor(n)이 각 페이지 주소를 만든다 */
export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (n: number) => string }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pageCount || Math.abs(n - page) <= 2,
  );
  return (
    <nav className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="페이지">
      {pages.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && pages[i - 1] !== n - 1 && <span className="text-ink-soft">…</span>}
          <Link
            href={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            className={`min-w-9 rounded-lg border-2 px-2.5 py-1 text-center font-bold ${
              n === page ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-sun"
            }`}
          >
            {n}
          </Link>
        </span>
      ))}
    </nav>
  );
}

/** ?page= 값을 1 이상의 정수로 */
export function parsePage(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
