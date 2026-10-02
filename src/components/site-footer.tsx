"use client";

import { usePathname } from "next/navigation";

// 광장은 화면 전체를 쓰므로 푸터를 숨긴다
export function SiteFooter() {
  if (usePathname() === "/town") return null;
  return (
    <footer className="border-t-2 border-line py-6 text-center text-sm text-ink-soft">
      Blogville · AI응용프로젝트
    </footer>
  );
}
