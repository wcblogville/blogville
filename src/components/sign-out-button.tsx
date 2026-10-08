"use client";

// 헤더 [로그아웃] (AUTH-04 / FR-029, FR-054): 확인 없이 signOut Server Action → 첫 화면.
// 폼이라 다른 사이트에서 보낸 요청은 Next.js의 Server Action Origin 검사에 걸린다 (FR-024)
import { signOut } from "@/app/(auth)/actions";
import { clearDraft } from "@/lib/draft";

/** userId가 있으면 로그아웃 요청을 보내기 전에 이 브라우저의 임시 글을 지운다 (POST-08 / FR-063, research R14) */
export function SignOutButton({ userId }: { userId?: string }) {
  return (
    <form action={signOut} onSubmit={() => userId && clearDraft(userId)} className="shrink-0">
      {/* 누르는 영역 44×44px 이상 (글자는 작게 두고 버튼 영역만 키운다) */}
      <button
        type="submit"
        className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-1 text-xs text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky sm:text-sm"
      >
        로그아웃
      </button>
    </form>
  );
}
