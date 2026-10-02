"use client";

import { useActionState } from "react";
import { attend, type AttendState } from "./actions";

export function AttendButton({ attended }: { attended: boolean }) {
  const [state, action, pending] = useActionState<AttendState>(attend, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="text-center">
        <p className="animate-bounce text-6xl">🎁</p>
        <p className="mt-2 font-display text-2xl">출석 완료! {state.streak}일 연속</p>
        {state.rankBonus && (
          <p className="mt-1 font-display text-xl text-sun-dark">{["🥇", "🥈", "🥉"][state.rank - 1]} 오늘 {state.rank}등으로 출석했어요!</p>
        )}
        <p className="mt-1 font-bold text-leaf-dark">
          ✨ 경험치 {state.exp} · 🪙 {state.coins} {state.bonus && "(7일 연속 보너스 포함!)"}{" "}
          {state.rankBonus && "(1~3등 보너스 포함!)"}
        </p>
      </div>
    );
  }
  if (attended || state.status === "already") {
    return <p className="font-display text-2xl text-ink-soft">✅ 오늘은 이미 출석했어요. 내일 또 만나요!</p>;
  }
  return (
    <form action={action}>
      <button disabled={pending} className="btn bg-berry px-10 py-4 text-xl text-white">
        {pending ? "편지 여는 중..." : "📮 출석하고 보상 받기"}
      </button>
    </form>
  );
}
