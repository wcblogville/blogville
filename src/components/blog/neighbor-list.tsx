// 블로그 주인의 이웃 목록 (SOC-06, 사용자 요청 2026-10-12 "친구 이웃 볼 수 있게 해서 그거 타고 가서 팔로우 할 수 있게 하자").
// 옆 칸 위젯(숫자 + 얼굴 몇 개)과 /@slug/neighbors 목록 화면이 같이 쓴다. 한 줄 = 얼굴·닉네임·블로그 이름(그 블로그로) + [+ 이웃 추가]
import Link from "next/link";
import { toggleFollow } from "@/app/blog/actions";
import { OwnerAvatar } from "@/components/blog/blog-header";
import type { NeighborRow, NeighborTab } from "@/server/neighbors";
import { Widget } from "./blog-sidebar";

export const NEIGHBOR_TAB_LABEL: Record<NeighborTab, string> = {
  following: "이웃",
  followers: "나를 이웃으로 둔 주민",
};

/** 보는 회원이 바로 이웃 추가·끊기. 자기 자신에게는 버튼이 없다 */
export function FollowToggle({ userId, following, nickname }: { userId: string; following: boolean; nickname: string }) {
  return (
    <form action={toggleFollow.bind(null, userId)} className="shrink-0">
      <button
        className={`pixel-btn pixel-btn-sm min-h-11 min-w-11 whitespace-nowrap px-3 text-sm ${following ? "bg-[#fffaf0] text-ink" : "bg-sky text-white"}`}
        aria-label={following ? `${nickname}님 이웃 끊기` : `${nickname}님을 이웃으로 추가`}
        data-follow-toggle={following ? "on" : "off"}
      >
        {following ? "✓ 이웃" : "+ 이웃 추가"}
      </button>
    </form>
  );
}

/** 이웃 한 줄 */
export function NeighborLine({ row, viewerId }: { row: NeighborRow; viewerId: string | null }) {
  const self = viewerId === row.userId;
  return (
    <li className="flex items-center gap-2" data-neighbor={row.slug}>
      <Link href={`/@${row.slug}`} className="pb-row flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 py-1.5">
        <OwnerAvatar photoKey={row.photoKey} characterAsset={row.characterAsset} nickname={row.nickname} size={40} outfit={row.outfit} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <b className="truncate">{row.nickname}</b>
            {row.mutual && (
              <span className="shrink-0 bg-[#ffe7a3] px-1.5 text-xs text-ink" title="서로 이웃" data-mutual>
                맞이웃
              </span>
            )}
            {self && <span className="shrink-0 text-xs text-ink-soft">(나)</span>}
          </span>
          <span className="block truncate text-sm text-ink-soft">{row.title}</span>
        </span>
      </Link>
      {viewerId && !self && <FollowToggle userId={row.userId} following={row.viewerFollows} nickname={row.nickname} />}
    </li>
  );
}

/**
 * 옆 칸 👫 이웃 위젯: 두 목록의 수(누르면 목록 화면) + 최근 이웃 얼굴 몇 개.
 * 로그인하지 않은 방문자에게는 숫자만 보여 준다 (목록은 회원에게만)
 */
export function NeighborsWidget({
  base,
  counts,
  preview,
  member,
}: {
  base: string;
  counts: { following: number; followers: number };
  preview: NeighborRow[];
  member: boolean;
}) {
  const tabs: NeighborTab[] = ["following", "followers"];
  return (
    <Widget title="👫 이웃" label="이웃 목록" data-widget="neighbors">
      <ul className="grid grid-cols-2 gap-2">
        {tabs.map((tab) => {
          const body = (
            <>
              <b className="block font-display text-xl text-ink" data-neighbor-count={tab}>
                {counts[tab].toLocaleString("ko-KR")}
              </b>
              <span className="block text-xs text-ink-soft">{NEIGHBOR_TAB_LABEL[tab]}</span>
            </>
          );
          return (
            <li key={tab}>
              {member ? (
                <Link href={`${base}/neighbors${tab === "followers" ? "?tab=followers" : ""}`} className="pixel-slot block min-h-11 px-2 py-1.5 text-center hover:bg-[#fff3d6]">
                  {body}
                </Link>
              ) : (
                <span className="pixel-slot block min-h-11 px-2 py-1.5 text-center">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
      {member ? (
        preview.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="최근 이웃">
            {preview.map((n) => (
              <li key={n.userId}>
                <Link href={`/@${n.slug}`} title={`${n.nickname} · ${n.title}`} className="block min-h-11 min-w-11" data-neighbor-face={n.slug}>
                  <OwnerAvatar photoKey={n.photoKey} characterAsset={n.characterAsset} nickname={n.nickname} size={40} outfit={n.outfit} />
                  <span className="sr-only">{n.nickname}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="mt-3 px-1 text-xs text-ink-soft">로그인하면 이웃 목록을 볼 수 있어요</p>
      )}
    </Widget>
  );
}
