"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toggleFavorite } from "@/app/town/actions";
import { openNotification } from "@/app/notifications/actions";
import { CharacterBadge } from "@/components/character";
import { notificationText, notificationTime, unreadBadge, type NotificationRow } from "@/lib/notifications";
import { townBus } from "./bus";
import { houseAt, townSpots, type TownSpot } from "./layout";
import type { TownData, TownFriend } from "./types";

/** 메뉴에 필요한 회원 정보 (방문자는 null) */
export type TownHudMember = {
  wallet: { coins: number; level: number; current: number; needed: number; isMax: boolean };
  unread: number;
  notifications: (NotificationRow & { id: number; createdAt: Date; readAt: Date | null })[];
  friends: TownFriend[];
};

type Panel =
  | { kind: "menu" }
  | { kind: "profile" }
  | { kind: "notifications" }
  | { kind: "teleport" }
  | { kind: "friends" }
  | { kind: "signpost" }
  | { kind: "mailbox"; slot: number };

/**
 * 광장 위 메뉴 버튼 (사용자 요청 2026-10-08): ① 내 프로필(코인, 경험치 현재/필요) ② 알림 ③ 텔레포트 ④ 친구 목록.
 * 광장의 정류장(집 11채 목록)과 우체통(소식)도 여기서 연다 (townBus "open").
 */
export function TownHud({ data, member, className = "" }: { data: TownData; member: TownHudMember | null; className?: string }) {
  const [panel, setPanel] = useState<Panel | null>(null);

  useEffect(() => townBus.on("open", (target) => setPanel(target.kind === "signpost" ? { kind: "signpost" } : { kind: "mailbox", slot: target.slot })), []);
  useEffect(() => {
    townBus.emit("panel", panel !== null);
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);
  useEffect(() => () => townBus.emit("panel", false), []);

  const teleport = (spot: TownSpot) => {
    townBus.emit("teleport", spot.key);
    setPanel(null);
  };
  const badge = member ? unreadBadge(member.unread) : null;

  return (
    <div className={`pointer-events-none absolute inset-0 z-20 ${className}`}>
      <div className="pointer-events-auto absolute left-3 top-3">
        <button
          type="button"
          onClick={() => setPanel(panel ? null : { kind: "menu" })}
          aria-expanded={panel !== null}
          aria-haspopup="dialog"
          className="relative flex min-h-11 items-center gap-2 rounded-full bg-white/95 px-4 font-display text-lg shadow-md hover:bg-cream focus-visible:outline-2 focus-visible:outline-sky"
        >
          <span aria-hidden>☰</span> 메뉴
          {badge && (
            <span aria-label={`알림 ${badge}개 안 읽음`} className="absolute -right-1 -top-1 min-w-5 rounded-full bg-berry px-1 text-center text-xs font-bold leading-5 text-white">
              {badge}
            </span>
          )}
        </button>

        {panel && (
          <div
            role="dialog"
            aria-label={PANEL_TITLE[panel.kind]}
            data-town-panel={panel.kind}
            className="mt-2 max-h-[calc(100dvh-var(--header-h)-5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur"
          >
            <div className="mb-2 flex items-center gap-2">
              {panel.kind !== "menu" && (
                <button type="button" onClick={() => setPanel({ kind: "menu" })} className="rounded-lg px-2 py-1 text-ink-soft hover:bg-cream" aria-label="메뉴로">
                  ‹
                </button>
              )}
              <h2 className="flex-1 font-display text-lg">{panel.kind === "mailbox" ? mailboxTitle(data, panel.slot) : PANEL_TITLE[panel.kind]}</h2>
              <button type="button" onClick={() => setPanel(null)} className="rounded-lg px-2 py-1 text-ink-soft hover:bg-cream" aria-label="닫기">
                ✕
              </button>
            </div>
            {panel.kind === "menu" && <MenuPanel member={member} badge={badge} open={setPanel} />}
            {panel.kind === "profile" && member && data.player && <ProfilePanel data={data} member={member} />}
            {panel.kind === "notifications" && member && <NotificationsPanel member={member} />}
            {panel.kind === "teleport" && <TeleportPanel data={data} withPlaces onPick={teleport} />}
            {panel.kind === "signpost" && <TeleportPanel data={data} onPick={teleport} />}
            {panel.kind === "friends" && member && <FriendsPanel data={data} member={member} onPick={teleport} />}
            {panel.kind === "mailbox" && (
              <MailboxPanel data={data} member={member} slot={panel.slot} onPick={teleport} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const PANEL_TITLE: Record<Panel["kind"], string> = {
  menu: "메뉴",
  profile: "👤 내 프로필",
  notifications: "🔔 알림",
  teleport: "✨ 텔레포트",
  friends: "👫 친구 목록",
  signpost: "🚏 정류장 · 어느 집으로 갈까요?",
  mailbox: "📮 우체통",
};

function mailboxTitle(data: TownData, slot: number) {
  const h = houseAt(data, slot);
  return slot === 0 ? "📮 내 우체통" : h ? `📮 ${h.nickname}님의 우체통` : "📮 우체통";
}

const itemClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cream focus-visible:outline-2 focus-visible:outline-sky disabled:cursor-not-allowed disabled:opacity-50";

function MenuPanel({ member, badge, open }: { member: TownHudMember | null; badge: string | null; open: (p: Panel) => void }) {
  if (!member) {
    return (
      <ul className="space-y-1">
        <li>
          <button type="button" className={itemClass} onClick={() => open({ kind: "teleport" })}>
            <span className="text-2xl" aria-hidden>✨</span> 텔레포트
          </button>
        </li>
        <li>
          <Link href="/" className={itemClass}>
            <span className="text-2xl" aria-hidden>🔑</span> 로그인하고 내 집 만들기
          </Link>
        </li>
      </ul>
    );
  }
  const items: { kind: Panel["kind"]; emoji: string; label: string; sub: string }[] = [
    { kind: "profile", emoji: "👤", label: "내 프로필", sub: `Lv.${member.wallet.level} · 🪙 ${member.wallet.coins.toLocaleString()}` },
    { kind: "notifications", emoji: "🔔", label: "알림", sub: badge ? `안 읽은 알림 ${badge}개` : "새 알림 없음" },
    { kind: "teleport", emoji: "✨", label: "텔레포트", sub: "상점·농장·이웃집 앞으로" },
    { kind: "friends", emoji: "👫", label: "친구 목록", sub: `이웃 ${member.friends.length}명` },
  ];
  return (
    <ul className="grid grid-cols-2 gap-2">
      {items.map((it) => (
        <li key={it.kind}>
          <button
            type="button"
            onClick={() => open({ kind: it.kind } as Panel)}
            className="card flex h-full min-h-24 w-full flex-col items-center justify-center gap-0.5 p-2 text-center hover:bg-cream focus-visible:outline-2 focus-visible:outline-sky"
          >
            <span className="text-3xl" aria-hidden>{it.emoji}</span>
            <span className="font-bold">{it.label}</span>
            <span className="line-clamp-1 text-xs text-ink-soft">{it.sub}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ProfilePanel({ data, member }: { data: TownData; member: TownHudMember }) {
  const { wallet } = member;
  const ratio = wallet.isMax ? 1 : wallet.current / wallet.needed;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <CharacterBadge asset={data.player!.characterAsset} size={64} />
        <div className="min-w-0">
          <p className="truncate font-display text-xl">{data.player!.nickname}</p>
          <p className="text-sm text-ink-soft">Lv.{wallet.level}</p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="font-bold">🪙 코인</dt>
        <dd data-profile-coins>{wallet.coins.toLocaleString()}</dd>
        <dt className="font-bold">✨ 경험치</dt>
        <dd>
          <span data-profile-exp>{wallet.isMax ? "최고 레벨" : `${wallet.current.toLocaleString()} / ${wallet.needed.toLocaleString()}`}</span>
          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-cream" aria-hidden>
            <span className="block h-full rounded-full bg-sun" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
        </dd>
      </dl>
      <div className="flex gap-2 text-sm">
        {data.myHouse && (
          <Link href={`/@${data.myHouse.slug}`} className="btn flex-1 text-center">🏠 내 블로그</Link>
        )}
        <Link href="/wallet" className="btn flex-1 text-center">📒 지갑</Link>
      </div>
    </div>
  );
}

function NotificationsPanel({ member }: { member: TownHudMember }) {
  return (
    <div>
      {member.notifications.length === 0 ? (
        <p className="px-2 py-4 text-center text-sm text-ink-soft">아직 알림이 없어요.</p>
      ) : (
        <ul className="divide-y-2 divide-line">
          {member.notifications.map((n) => (
            <li key={n.id}>
              <form action={openNotification}>
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className={`${itemClass} ${n.readAt ? "text-ink-soft" : "font-bold"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{notificationText(n)}</span>
                    <span className="block text-xs font-normal text-ink-soft">{notificationTime(new Date(n.createdAt))}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <Link href="/notifications" className="mt-2 block rounded-xl px-3 py-2 text-center text-sm text-leaf-dark hover:bg-cream">
        알림함 전체 보기 ›
      </Link>
    </div>
  );
}

function SpotButton({ spot, onPick, sub }: { spot: TownSpot; onPick: (s: TownSpot) => void; sub?: string }) {
  return (
    <button type="button" className={itemClass} disabled={spot.empty} onClick={() => onPick(spot)} data-spot={spot.key}>
      <span className="text-2xl" aria-hidden>{spot.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{spot.label}</span>
        {sub && <span className="block truncate text-xs text-ink-soft">{sub}</span>}
      </span>
    </button>
  );
}

function TeleportPanel({ data, withPlaces = false, onPick }: { data: TownData; withPlaces?: boolean; onPick: (s: TownSpot) => void }) {
  const { places, houses } = townSpots(data);
  return (
    <div className="space-y-2">
      {withPlaces && (
        <>
          <h3 className="px-2 text-xs font-bold text-ink-soft">마을</h3>
          <ul>
            {places.map((p) => (
              <li key={p.key}>
                <SpotButton spot={p} onPick={onPick} />
              </li>
            ))}
          </ul>
          <h3 className="px-2 text-xs font-bold text-ink-soft">집 (내 집 + 즐겨찾기 이웃 {houses.length - 1}자리)</h3>
        </>
      )}
      <ol>
        {houses.map((h, i) => (
          <li key={h.key}>
            <SpotButton spot={h} onPick={onPick} sub={houseAt(data, i)?.title ?? (i === 0 ? undefined : "친구 목록에서 ⭐를 누르면 집이 생겨요")} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 친구 목록과 ⭐ 즐겨찾기. 휴대폰 메뉴(TownMenu)도 쓴다 (onPick 없음 = 텔레포트 버튼 없음) */
export function FriendsPanel({ data, member, onPick }: { data: TownData; member: TownHudMember; onPick?: (s: TownSpot) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { houses } = townSpots(data);
  const houseSpot = (slug: string) => houses.find((_, i) => i > 0 && houseAt(data, i)?.slug === slug);
  const favorites = member.friends.filter((f) => f.isFavorite).length;

  if (member.friends.length === 0) {
    return <p className="px-2 py-4 text-center text-sm text-ink-soft">아직 이웃이 없어요. 블로그에서 [+ 이웃]을 눌러 보세요.</p>;
  }
  return (
    <div>
      <p className="px-2 pb-2 text-xs text-ink-soft">⭐ 즐겨찾기한 이웃의 집이 마을 둘레에 생겨요 ({favorites}/10)</p>
      {error && (
        <p role="alert" className="mb-2 rounded-xl bg-[#ffe4e4] px-3 py-2 text-sm text-berry">
          {error}
        </p>
      )}
      <ul className="divide-y-2 divide-line">
        {member.friends.map((f) => {
          const spot = houseSpot(f.slug);
          return (
            <li key={f.userId} className="flex items-center gap-2 py-1.5" data-friend={f.nickname}>
              <CharacterBadge asset={f.characterAsset} size={36} />
              <Link href={`/@${f.slug}`} className="min-w-0 flex-1 rounded-lg px-1 hover:bg-cream">
                <span className="block truncate text-sm font-bold">
                  {f.nickname}
                  {f.followsBack && <span className="ml-1 text-xs font-normal text-leaf-dark">서로 이웃</span>}
                </span>
                <span className="block truncate text-xs text-ink-soft">{f.title}</span>
              </Link>
              {spot && onPick && (
                <button type="button" onClick={() => onPick(spot)} className="rounded-lg px-2 py-1 text-lg hover:bg-cream" aria-label={`${f.nickname}의 집 앞으로 텔레포트`}>
                  ✨
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                aria-pressed={f.isFavorite}
                aria-label={f.isFavorite ? `${f.nickname} 즐겨찾기 끄기` : `${f.nickname} 즐겨찾기`}
                onClick={() =>
                  start(async () => {
                    const r = await toggleFavorite(f.userId);
                    setError(r.ok ? null : r.error);
                  })
                }
                className="rounded-lg px-2 py-1 text-lg hover:bg-cream disabled:opacity-50"
              >
                {f.isFavorite ? "⭐" : "☆"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MailboxPanel({
  data,
  member,
  slot,
  onPick,
}: {
  data: TownData;
  member: TownHudMember | null;
  slot: number;
  onPick: (s: TownSpot) => void;
}) {
  // 내 우체통 = 내 알림
  if (slot === 0 && member && data.myHouse) return <NotificationsPanel member={member} />;
  const h = houseAt(data, slot);
  if (!h) return <p className="px-2 py-4 text-center text-sm text-ink-soft">빈 집터예요.</p>;
  const spot = townSpots(data).houses[slot];
  return (
    <div>
      <p className="px-2 pb-2 text-sm text-ink-soft">{h.title}의 새 글</p>
      {h.recentPosts.length === 0 ? (
        <p className="px-2 py-3 text-center text-sm text-ink-soft">아직 공개 글이 없어요.</p>
      ) : (
        <ul className="divide-y-2 divide-line">
          {h.recentPosts.map((p) => (
            <li key={p.id}>
              <Link href={`/@${h.slug}/${p.id}`} className={itemClass}>
                <span aria-hidden>✉️</span>
                <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2 text-sm">
        <Link href={`/@${h.slug}`} className="btn flex-1 text-center">🏠 집에 들어가기</Link>
        {spot && (
          <button type="button" onClick={() => onPick(spot)} className="btn flex-1">
            ✨ 집 앞으로
          </button>
        )}
      </div>
    </div>
  );
}
