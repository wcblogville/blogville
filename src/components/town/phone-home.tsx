"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PHONE_MEDIA } from "@/lib/device";

/**
 * 휴대폰 회원의 광장 자리 (사용자 결정 2026-10-09): 휴대폰에는 광장이 없고 내 블로그가 첫 화면이라 바로 옮긴다.
 * PC에서는 CSS로 숨기고(`hidden phone:block`), 화면 조건(PHONE_MEDIA)이 맞을 때만 옮긴다.
 * 아래 탭의 ☰ 메뉴(/town?menu=1)는 이것 대신 마을 메뉴를 보여 준다 (src/app/town/page.tsx).
 * 다른 회원의 마을(/town/주소)은 그 회원의 블로그로 옮긴다
 */
export function PhoneHome({ href, label = "내 블로그로 가는 중…", className = "" }: { href: string; label?: string; className?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (window.matchMedia(PHONE_MEDIA).matches) router.replace(href);
  }, [href, router]);
  return (
    <p className={`px-4 py-10 text-center text-sm text-ink-soft ${className}`}>
      <Link href={href} replace className="underline">
        {label}
      </Link>
    </p>
  );
}
