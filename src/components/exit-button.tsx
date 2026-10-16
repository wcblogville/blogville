"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PixelIcon } from "@/components/pixel-icon";
import { isTownPath } from "@/components/town/layout";
import { returnTownPath } from "@/components/town/return-spot";
import { titleDataUri, TITLE_SIZE } from "@/lib/art/landing";
import { FIND_PASSWORD_PATH } from "@/lib/password-reset";

// 광장이 메인이라 다른 곳으로 가는 메뉴는 두지 않는다. 광장 밖에서는 "나가기"로 광장에 돌아온다.
// 휴대폰의 회원은 광장이 없고 아래 탭으로 다니므로 나가기를 숨긴다 (사용자 결정 2026-10-09)
// 비밀번호 찾기(로그인 전 화면)도 광장 대신 로고(첫 화면으로)를 보인다
const HIDDEN_ON = new Set(["/", FIND_PASSWORD_PATH]);

export function ExitButton({ member = false }: { member?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  if (HIDDEN_ON.has(pathname) || isTownPath(pathname)) return null;
  // 가입 직후 블로그(?welcome=1)에서 나가면 문으로 나간 것과 같게 첫 마을 환영으로 간다
  // 친구 마을에서 들어온 곳이면 그 친구 마을로 돌아간다 (들어간 자리는 town-game이 기억한다)
  const exit = (e: React.MouseEvent) => {
    const welcome = new URLSearchParams(window.location.search).has("welcome");
    const back = returnTownPath();
    if (!welcome && back === "/town") return;
    e.preventDefault();
    router.push(welcome ? "/town?welcome=1" : back);
  };
  return (
    <Link href="/town" onClick={exit} className={`pixel-btn pixel-btn-sm shrink-0 whitespace-nowrap bg-white text-ink max-sm:px-3 ${member ? "phone:hidden" : ""}`}>
      <span>← <span className="hidden sm:inline">광장으로 </span>나가기</span>
    </Link>
  );
}

/**
 * 헤더 로고. 좁은 화면에서 나가기 버튼이 보일 때는 숨긴다.
 * 둘 다 광장으로 가는데, 자리가 모자라 나가기 버튼이 코인과 겹쳐 보였다 (이슈 #5).
 * 휴대폰의 회원은 나가기가 없으니 로고를 그대로 둔다. compact(관리자)는 휴대폰에서 로고 글자 대신 집 그림
 */
export function HomeLogo({ href, member = false, compact = false }: { href: string; member?: boolean; compact?: boolean }) {
  const pathname = usePathname();
  const exitShown = !HIDDEN_ON.has(pathname) && !isTownPath(pathname) && !member;
  // 로고는 첫 화면 제목과 같은 도트 글자 그림 (2026-10-12): 막대에서는 2배(휴대폰)·3배, 광장 위에서는 3배 (휴대폰 ☰ 메뉴는 2배)
  return (
    <Link
      href={href}
      aria-label="Blogville"
      className={`grid min-h-11 shrink-0 place-items-center ${exitShown ? "max-sm:hidden" : ""} group-data-[town]:pointer-events-auto focus-visible:outline-2 focus-visible:outline-sky`}
    >
      {compact ? (
        // 관리자는 휴대폰 헤더에 👑 칸이 하나 더 있어 로고 대신 도트 집 그림만 (375px에서 넘치지 않게)
        <PixelIcon name="house" scale={2} className="sm:hidden group-data-[town]:hidden group-data-[town]:phone:block" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
        <img src={titleDataUri(2)} alt="" width={TITLE_SIZE.w * 2} height={TITLE_SIZE.h * 2} className="pixelated sm:hidden group-data-[town]:hidden group-data-[town]:phone:block" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
      <img src={titleDataUri(3)} alt="" width={TITLE_SIZE.w * 3} height={TITLE_SIZE.h * 3} className="pixelated max-sm:hidden group-data-[town]:block group-data-[town]:phone:hidden" />
    </Link>
  );
}
