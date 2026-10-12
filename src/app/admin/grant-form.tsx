"use client";

// 관리자 테스트 지급 폼 (AUTH-10). 누르는 영역 44px, 버튼 글자 한 줄 (FR-054)
import { useActionState, useState } from "react";
import { GRANT_COINS_MAX, GRANT_EXP_MAX, QUICK_COINS } from "@/lib/admin-grant";
import { adminGrant, type AdminGrantState } from "./actions";
import { PixelIcon } from "@/components/pixel-icon";

const btn = "pixel-btn min-h-11 shrink-0 whitespace-nowrap px-3 text-sm";

export function AdminGrantForm({ adminUsername }: { adminUsername: string }) {
  const [state, action, pending] = useActionState<AdminGrantState, FormData>(adminGrant, {});
  // 받을 회원은 지급 뒤에도 남긴다 (React가 폼을 비워도 이어서 빠른 버튼을 누를 수 있게). 코인·경험치 칸은 비워 두 번 주는 실수를 막는다
  const [username, setUsername] = useState("");
  return (
    <form action={action} className="space-y-4" data-admin-grant>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-bold">받을 회원 아이디</span>
          <input name="username" value={username} onChange={(e) => setUsername(e.target.value)} className="pixel-input mt-1 w-full" placeholder={`비우면 나 (${adminUsername})`} autoComplete="off" />
        </label>
        <label className="block text-sm">
          <span className="font-bold">코인</span>
          <input name="coins" type="number" inputMode="numeric" min={0} max={GRANT_COINS_MAX} step={1} className="pixel-input mt-1 w-full" placeholder="0" />
        </label>
        <label className="block text-sm">
          <span className="font-bold">경험치</span>
          <input name="exp" type="number" inputMode="numeric" min={0} max={GRANT_EXP_MAX} step={1} className="pixel-input mt-1 w-full" placeholder="0" />
        </label>
      </div>
      <p className="text-xs text-ink-soft">
        한 번에 코인 {GRANT_COINS_MAX.toLocaleString()}개, 경험치 {GRANT_EXP_MAX.toLocaleString()}까지. 내역에는 ‘관리자 테스트 지급’으로 남아요.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={`${btn} bg-leaf text-white`}>
          {pending ? "지급 중" : "지급하기"}
        </button>
        <button type="submit" name="preset" value="coins" disabled={pending} className={`${btn} bg-sun text-ink`}>
          +{QUICK_COINS.toLocaleString()} 코인
        </button>
        <button type="submit" name="preset" value="max_level" disabled={pending} className={`${btn} bg-white text-ink`}>
          Lv.99까지 경험치
        </button>
      </div>
      <div aria-live="polite">
        {state.ok === false && <p className="text-sm text-berry" role="alert">{state.error}</p>}
        {state.ok && (
          <p className="text-sm" data-grant-result>
            <PixelIcon name="check" scale={1} label="완료" className="mr-1 align-[-1px]" />
            <b>{state.nickname ?? state.username}</b> (@{state.username})에게 코인 +{state.coinsGranted.toLocaleString()}, 경험치 +
            {state.expGranted.toLocaleString()}
            {state.levelUps > 0 && ` (레벨 ${state.levelUps}번 오름)`} → 지금 <b data-grant-level>Lv.{state.level}</b> · 경험치{" "}
            {state.exp.toLocaleString()} · 코인 <b data-grant-coins>{state.coins.toLocaleString()}</b>
          </p>
        )}
      </div>
    </form>
  );
}
