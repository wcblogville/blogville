"use client";

// 테스트 기간 한꺼번에 주기 (AUTH-10): 모든 회원 최소 Lv.50 + 코인 10만 개. 누르기 전에 한 번 더 묻는다
import { useActionState } from "react";
import { TEST_BOOST } from "@/lib/admin-grant";
import { adminTestBoost, type AdminTestBoostState } from "./actions";
import { PixelIcon } from "@/components/pixel-icon";

export function AdminTestBoostForm() {
  const [state, action, pending] = useActionState<AdminTestBoostState, FormData>(() => adminTestBoost(), {});
  const coins = TEST_BOOST.coins.toLocaleString();
  return (
    <form
      action={action}
      className="space-y-3 border-t-2 border-dashed border-ink/20 pt-4"
      data-admin-test-boost
      onSubmit={(e) => {
        if (!confirm(`모든 회원을 Lv.${TEST_BOOST.minLevel} 이상으로 올리고 코인 ${coins}개를 줄까요?`)) e.preventDefault();
      }}
    >
      <p className="text-sm">
        <b>모든 회원 한꺼번에</b>: Lv.{TEST_BOOST.minLevel}보다 낮으면 Lv.{TEST_BOOST.minLevel}까지 경험치를, 코인 {coins}개는 한 사람에게 한 번만 줘요. 다시 누르면 새로 온
        회원만 받아요.
      </p>
      <button type="submit" disabled={pending} className="pixel-btn min-h-11 shrink-0 whitespace-nowrap bg-sun px-3 text-sm text-ink">
        {pending ? "주는 중" : `모두 Lv.${TEST_BOOST.minLevel} + ${coins} 코인`}
      </button>
      <div aria-live="polite">
        {state.ok && (
          <p className="text-sm" data-test-boost-result>
            <PixelIcon name="check" scale={1} label="완료" className="mr-1 align-[-1px]" />
            회원 {state.members}명 중 코인 받은 회원 <b data-boost-coins>{state.coinMembers}</b>명, 레벨 올린 회원 <b data-boost-levels>{state.levelMembers}</b>명
          </p>
        )}
      </div>
    </form>
  );
}
