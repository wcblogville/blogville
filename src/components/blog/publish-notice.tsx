"use client";

import { useEffect } from "react";
import { REWARD_RULES } from "@/lib/game";
import { clearDraft } from "@/lib/draft";

/**
 * 발행 안내 (POST-01·GAME-05 / FR-013, research R13). 주인에게만, 발행 직후 한 번.
 * 처음 그린 뒤 주소에서 ?new를 지워 새로고침해도 다시 보이지 않게 하고, 발행이 성공했으니 임시 글을 지운다 (FR-063)
 */
export function PublishNotice({ kind, userId }: { kind: "reward" | "noReward"; userId: string }) {
  useEffect(() => {
    clearDraft(userId);
    const url = new URL(window.location.href);
    if (url.searchParams.has("new")) {
      url.searchParams.delete("new");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [userId]);

  return (
    <div className="card mb-6 border-sun bg-[#fff3d6] p-4 text-center" role="status">
      🎉 글을 발행했어요!{" "}
      {kind === "reward" ? (
        <b>
          ✨ 경험치 {REWARD_RULES.post.exp} · 🪙 {REWARD_RULES.post.coins} 코인을 받았어요
        </b>
      ) : (
        <span className="text-ink-soft">(비공개 글, 짧은 글, 또는 오늘 글쓰기 보상 {REWARD_RULES.post.dailyLimit}번을 다 받아서 보상은 없어요)</span>
      )}
    </div>
  );
}
