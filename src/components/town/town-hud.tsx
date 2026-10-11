"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { setTownLot, toggleFavorite } from "@/app/town/actions";
import { openNotification } from "@/app/notifications/actions";
import { OwnerAvatar } from "@/components/blog/blog-header";
import { CharacterBadge } from "@/components/character";
import { SignOutButton } from "@/components/sign-out-button";
import { notificationText, notificationTime, unreadBadge, type NotificationRow } from "@/lib/notifications";
import { townBus } from "./bus";
import { houseAt, LOT_AREAS, townSpots, type TownSpot } from "./layout";
import type { TownData, TownFriend } from "./types";

/** 메뉴에 필요한 회원 정보 (방문자는 null) */
export type TownHudMember = {
  userId: string;
  isAdmin: boolean;
  /** 내 블로그 주소 (남의 마을을 구경할 때는 0번 집이 내 집이 아니라서 따로 둔다) */
  slug: string;
  /** ☰ 내 프로필에 보일 사진·블로그 제목 (헤더 상태창 TOWN-10 대신, 사용자 결정 2026-10-09) */
  photoKey: string | null;
  blogTitle: string;
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
  | { kind: "lots"; slot: number | null }
  | { kind: "mailbox"; slot: number };

/**
 * 광장 위 메뉴 버튼 (사용자 요청 2026-10-08): ① 내 프로필(코인, 경험치 현재/필요) ② 알림 ③ 텔레포트 ④ 친구 목록.
 * 광장의 우체통(소식)도 여기서 연다 (townBus "open"). 광장 꾸미기 창은 사용자 결정(2026-10-11, 집 꾸미기에 집중)으로 뺐다 (TOWN-16).
 * 다른 회원의 마을(data.host)을 구경할 때는 위에 "누구의 마을"과 [내 마을로]를 띄운다
 */
export function TownHud({
  data,
  member,
  className = "",
}: {
  data: TownData;
  member: TownHudMember | null;
  className?: string;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);

  useEffect(
    () => townBus.on("open", (target) => setPanel(target.kind === "lot" ? { kind: "lots", slot: target.slot } : { kind: "mailbox", slot: target.slot })),
    [],
  );
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
      {data.host && (
        <div
          className="pointer-events-auto absolute left-1/2 top-16 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/95 py-1 pl-4 pr-1 shadow-md"
          data-host-banner
        >
          <span className="font-display text-lg">🏘 {data.host.nickname}님의 마을</span>
          <Link href="/town" className="btn min-h-10 bg-leaf py-1 text-sm text-white">
            🏠 내 마을로
          </Link>
        </div>
      )}
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
            className="mt-2 max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur"
          >
            <div className="mb-2 flex items-center gap-2">
              {panel.kind !== "menu" && (
                <button type="button" onClick={() => setPanel({ kind: "menu" })} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg text-ink-soft hover:bg-cream" aria-label="메뉴로">
                  ‹
                </button>
              )}
              <h2 className="flex-1 font-display text-lg">{panel.kind === "mailbox" ? mailboxTitle(data, panel.slot) : PANEL_TITLE[panel.kind]}</h2>
              <button type="button" onClick={() => setPanel(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-cream" aria-label="닫기">
                ✕
              </button>
            </div>
            {panel.kind === "menu" && (
              <MenuPanel member={member} badge={badge} open={setPanel} ownTown={!data.host} />
            )}
            {panel.kind === "profile" && member && data.player && <ProfilePanel data={data} member={member} />}
            {panel.kind === "notifications" && member && <NotificationsPanel member={member} />}
            {panel.kind === "teleport" && <TeleportPanel data={data} withPlaces onPick={teleport} />}
            {panel.kind === "friends" && member && <FriendsPanel data={data} member={member} onPick={teleport} />}
            {panel.kind === "lots" && member && !data.host && (
              <LotsPanel data={data} member={member} slot={panel.slot} choose={(slot) => setPanel({ kind: "lots", slot })} onPick={teleport} />
            )}
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
  lots: "🏡 이웃 집 자리",
  mailbox: "📮 우체통",
};

function mailboxTitle(data: TownData, slot: number) {
  const h = houseAt(data, slot);
  return slot === 0 && !data.host ? "📮 내 우체통" : h ? `📮 ${h.nickname}님의 우체통` : "📮 우체통";
}

const itemClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cream focus-visible:outline-2 focus-visible:outline-sky disabled:cursor-not-allowed disabled:opacity-50";

function MenuPanel({
  member,
  badge,
  open,
  ownTown,
}: {
  member: TownHudMember | null;
  badge: string | null;
  open: (p: Panel) => void;
  /** 내 마을인가 (남의 마을 구경 중에는 집 자리를 고를 수 없다) */
  ownTown: boolean;
}) {
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
    ...(ownTown ? [{ kind: "lots" as const, emoji: "🏡", label: "이웃 집 자리", sub: "즐겨찾기 이웃이 살 곳 고르기" }] : []),
  ];
  return (
    <ul className="grid grid-cols-2 gap-2">
      {items.map((it, i) => (
        // 칸이 홀수면 마지막 칸은 한 줄을 다 쓴다
        <li key={it.kind} className={i === items.length - 1 && items.length % 2 === 1 ? "col-span-2" : undefined}>
          <button
            type="button"
            onClick={() => open((it.kind === "lots" ? { kind: "lots", slot: null } : { kind: it.kind }) as Panel)}
            className="card flex h-full min-h-24 w-full flex-col items-center justify-center gap-0.5 p-2 text-center hover:bg-cream focus-visible:outline-2 focus-visible:outline-sky"
          >
            <span className="text-3xl" aria-hidden>{it.emoji}</span>
            <span className="font-bold">{it.label}</span>
            <span className="line-clamp-1 text-xs text-ink-soft">{it.sub}</span>
          </button>
        </li>
      ))}
      <li className="col-span-2">
        <AccountLinks member={member} />
      </li>
    </ul>
  );
}

/** 마을에는 헤더 막대가 없어서 내 정보·관리자·로그아웃을 메뉴 아래에 둔다 (사용자 요청 2026-10-08) */
export function AccountLinks({ member }: { member: TownHudMember }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 border-t-2 border-line pt-2 text-sm" data-account-links>
      <Link href="/settings/account" className="inline-flex min-h-11 items-center rounded-lg px-2 hover:bg-cream">
        ⚙️ 내 정보
      </Link>
      {member.isAdmin && (
        <Link href="/admin" className="inline-flex min-h-11 items-center rounded-lg px-2 hover:bg-cream">
          👑 관리자
        </Link>
      )}
      <SignOutButton userId={member.userId} />
    </div>
  );
}

/** 내 프로필: 사진(없으면 캐릭터)·닉네임·블로그 제목·레벨·코인·경험치. 휴대폰 ☰ 메뉴(town-menu.tsx)도 쓴다 (links=false면 아래 버튼 줄 없이) */
export function ProfilePanel({ data, member, links = true }: { data: TownData; member: TownHudMember; links?: boolean }) {
  const { wallet } = member;
  const ratio = wallet.isMax ? 1 : wallet.current / wallet.needed;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {member.photoKey ? (
          <OwnerAvatar photoKey={member.photoKey} characterAsset={data.player!.characterAsset} nickname={data.player!.nickname} size={64} />
        ) : (
          <CharacterBadge asset={data.player!.characterAsset} outfit={data.player!.outfit} size={64} />
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-xl">{data.player!.nickname}</p>
          <p className="truncate text-sm text-ink-soft" data-profile-blog>
            📖 {member.blogTitle}
          </p>
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
      {/* 꾸미기(옷·배경·가구)로 가는 길이 블로그 🎨 하나뿐이라 여기에도 둔다 */}
      {links && (
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/@${member.slug}`} className="btn flex-1 whitespace-nowrap text-center">🏠 내 블로그</Link>
        <Link href="/closet" className="btn flex-1 whitespace-nowrap text-center">🎨 꾸미기</Link>
        <Link href="/wallet" className="btn flex-1 whitespace-nowrap text-center">📒 지갑</Link>
      </div>
      )}
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
          <h3 className="px-2 text-xs font-bold text-ink-soft">
            집 ({data.host ? `${data.host.nickname}님 집` : "내 집"} + 즐겨찾기 이웃 {houses.length - 1}자리)
          </h3>
        </>
      )}
      <ol>
        {houses.map((h, i) => (
          <li key={h.key}>
            <SpotButton spot={h} onPick={onPick} sub={houseAt(data, i)?.title ?? (i === 0 || data.host ? undefined : "친구 목록에서 ⭐를 누르면 집이 생겨요")} />
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
  const favorites = member.friends.filter((f) => f.isFavorite && !f.isNotice).length;

  if (member.friends.length === 0) {
    return <p className="px-2 py-4 text-center text-sm text-ink-soft">아직 이웃이 없어요. 블로그에서 [+ 이웃 추가]를 눌러 보세요.</p>;
  }
  return (
    <div>
      <p className="px-2 pb-2 text-xs text-ink-soft">⭐ 즐겨찾기한 이웃의 집이 마을에 생겨요 ({favorites}/10)</p>
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
                <button type="button" onClick={() => onPick(spot)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg hover:bg-cream" aria-label={`${f.nickname}의 집 앞으로 텔레포트`}>
                  ✨
                </button>
              )}
              {/* 친구의 마을 구경 (사용자 요청 2026-10-09). 광장이 있는 화면(onPick)에서만, 공지 블로그는 마을이 없다 */}
              {onPick && !f.isNotice && (
                <Link
                  href={`/town/${f.slug}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg hover:bg-cream"
                  aria-label={`${f.nickname}의 마을 구경`}
                  title="마을 구경"
                >
                  🏘
                </Link>
              )}
              {f.isNotice && !f.isFavorite ? (
                // 공지 블로그는 마을에 집이 없어 ⭐ 대신 표시만 (이미 켜 둔 ⭐는 끌 수 있게 버튼을 남긴다)
                <span className="inline-flex min-h-11 min-w-11 items-center justify-center text-lg" title="공지사항 블로그는 마을에 집이 없어요" aria-label="공지사항 블로그">
                  📢
                </span>
              ) : (
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
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg hover:bg-cream disabled:opacity-50"
                >
                  {f.isFavorite ? "⭐" : "☆"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * 이웃 집 자리 (TOWN-18, 사용자 요청 2026-10-11): 1~10번 자리마다 누가 사는지 보고, 자리를 눌러 즐겨찾기 이웃 중 한 명을 고른다.
 * 그 자리에 다른 이웃이 있으면 둘이 자리를 맞바꾼다 (서버 setTownLot). 광장의 빈 집터를 눌러도 이 창이 그 자리로 열린다
 */
function LotsPanel({
  data,
  member,
  slot,
  choose,
  onPick,
}: {
  data: TownData;
  member: TownHudMember;
  slot: number | null;
  choose: (slot: number | null) => void;
  onPick: (s: TownSpot) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const favorites = member.friends.filter((f) => f.isFavorite && !f.isNotice);
  const { houses } = townSpots(data);

  if (slot !== null) {
    const here = houseAt(data, slot);
    return (
      <div data-lot-picker={slot}>
        <p className="px-2 pb-2 text-sm text-ink-soft">
          <b>{slot}번 자리</b> · {LOT_AREAS[slot]} — 여기 살 이웃을 고르세요
        </p>
        {error && (
          <p role="alert" className="mb-2 rounded-xl bg-[#ffe4e4] px-3 py-2 text-sm text-berry">
            {error}
          </p>
        )}
        {favorites.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-ink-soft">⭐ 즐겨찾기한 이웃이 없어요. 친구 목록에서 ⭐를 눌러 보세요.</p>
        ) : (
          <ul className="divide-y-2 divide-line">
            {favorites.map((f) => {
              const now = data.neighbors.find((h) => h.slug === f.slug)?.lot;
              const current = here?.slug === f.slug;
              return (
                <li key={f.userId}>
                  <button
                    type="button"
                    disabled={pending || current}
                    data-lot-friend={f.nickname}
                    onClick={() =>
                      start(async () => {
                        const r = await setTownLot(f.userId, slot);
                        setError(r.ok ? null : r.error);
                        if (r.ok) choose(null);
                      })
                    }
                    className={itemClass}
                  >
                    <CharacterBadge asset={f.characterAsset} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{f.nickname}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {current ? "지금 이 자리에 살아요" : now ? `지금 ${now}번 자리${here ? ` → ${here.nickname}님과 자리 바꾸기` : ""}` : "아직 자리가 없어요"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" onClick={() => choose(null)} className="btn mt-2 w-full text-sm">
          ‹ 자리 목록
        </button>
      </div>
    );
  }
  return (
    <div>
      <p className="px-2 pb-2 text-xs text-ink-soft">자리를 누르면 그곳에 살 ⭐ 즐겨찾기 이웃을 고를 수 있어요. 안 고른 이웃은 남은 자리에 차례로 살아요.</p>
      <ol>
        {houses.slice(1).map((spot, k) => {
          const i = k + 1;
          const h = houseAt(data, i);
          return (
            <li key={spot.key} className="flex items-center gap-1">
              <button type="button" className={itemClass} onClick={() => choose(i)} data-lot={i}>
                <span className="text-2xl" aria-hidden>{h ? "🏠" : "🪧"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {i}번 · {h ? `${h.nickname}의 집` : "빈 집터"}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">{LOT_AREAS[i]}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onPick(spot)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg hover:bg-cream"
                aria-label={`${i}번 자리로 텔레포트`}
              >
                ✨
              </button>
            </li>
          );
        })}
      </ol>
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
  // 내 우체통 = 내 알림 (남의 마을에서 0번 집은 그 주인의 집이라 새 글을 보여 준다)
  if (slot === 0 && member && data.myHouse && !data.host) return <NotificationsPanel member={member} />;
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
      {/* 이웃의 마을 구경 (회원만). 지금 구경하는 마을의 주인 집과 내 집은 빼고 */}
      {member && h.slug !== member.slug && !(slot === 0 && data.host) && (
        <Link href={`/town/${h.slug}`} className="btn mt-2 block w-full text-center text-sm">
          🏘 {h.nickname}님의 마을 구경
        </Link>
      )}
    </div>
  );
}
