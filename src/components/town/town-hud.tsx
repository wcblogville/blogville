"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { placeDecoration, toggleFavorite } from "@/app/town/actions";
import { openNotification } from "@/app/notifications/actions";
import { OwnerAvatar } from "@/components/blog/blog-header";
import { CharacterBadge } from "@/components/character";
import { ItemArt } from "@/components/item-art";
import { SignOutButton } from "@/components/sign-out-button";
import { decoSlotLevel, MAX_DECO_SLOTS } from "@/lib/house";
import { notificationText, notificationTime, unreadBadge, type NotificationRow } from "@/lib/notifications";
import { townBus } from "./bus";
import { houseAt, townSpots, type TownSpot } from "./layout";
import type { TownData, TownDecoration, TownFriend } from "./types";

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
  /** 내가 가진 광장 장식 (광장 꾸미기 창의 고르기 목록) */
  decos: { itemId: number; name: string; assetKey: string }[];
};

type Panel =
  | { kind: "menu" }
  | { kind: "profile" }
  | { kind: "notifications" }
  | { kind: "teleport" }
  | { kind: "friends" }
  | { kind: "deco" }
  | { kind: "mailbox"; slot: number };

/**
 * 광장 위 메뉴 버튼 (사용자 요청 2026-10-08): ① 내 프로필(코인, 경험치 현재/필요) ② 알림 ③ 텔레포트 ④ 친구 목록.
 * 내 마을에서는 ⑤ 광장 꾸미기 (사용자 요청 2026-10-09, ?deco=1이면 처음부터 연다). 광장의 우체통(소식)도 여기서 연다 (townBus "open").
 * 다른 회원의 마을(data.host)을 구경할 때는 위에 "누구의 마을"과 [내 마을로]를 띄운다
 */
export function TownHud({
  data,
  member,
  openDeco = false,
  className = "",
}: {
  data: TownData;
  member: TownHudMember | null;
  openDeco?: boolean;
  className?: string;
}) {
  const decorating = Boolean(member && !data.host);
  const [panel, setPanel] = useState<Panel | null>(openDeco && decorating ? { kind: "deco" } : null);
  // 꾸미기 창에서 바꾼 장식. 광장 데이터가 새로 오면(서버가 다시 그림) 그 값을 쓴다
  const [placed, setPlaced] = useState<{ base: TownData; list: TownDecoration[] } | null>(null);
  const decorations = placed?.base === data ? placed.list : data.decorations;
  const changeDecorations = (list: TownDecoration[]) => {
    setPlaced({ base: data, list });
    townBus.emit("decorations", list);
  };

  useEffect(() => townBus.on("open", (target) => setPanel({ kind: "mailbox", slot: target.slot })), []);
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
              <MenuPanel member={member} badge={badge} open={setPanel} deco={decorating ? { placed: decorations.length, slots: data.decoSlots } : null} />
            )}
            {panel.kind === "profile" && member && data.player && <ProfilePanel data={data} member={member} />}
            {panel.kind === "notifications" && member && <NotificationsPanel member={member} />}
            {panel.kind === "teleport" && <TeleportPanel data={data} withPlaces onPick={teleport} />}
            {panel.kind === "friends" && member && <FriendsPanel data={data} member={member} onPick={teleport} />}
            {panel.kind === "deco" && member && decorating && (
              <DecoPanel data={data} member={member} decorations={decorations} onChange={changeDecorations} />
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
  deco: "🌷 광장 꾸미기",
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
  deco,
}: {
  member: TownHudMember | null;
  badge: string | null;
  open: (p: Panel) => void;
  /** 내 마을이면 광장 꾸미기 칸 (놓은 장식 수 / 열린 자리 수), 남의 마을이면 null */
  deco: { placed: number; slots: number } | null;
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
  ];
  if (deco) items.push({ kind: "deco", emoji: "🌷", label: "광장 꾸미기", sub: `장식 ${deco.placed}/${deco.slots}자리` });
  return (
    <ul className="grid grid-cols-2 gap-2">
      {items.map((it, i) => (
        // 칸이 홀수면 마지막 칸은 한 줄을 다 쓴다
        <li key={it.kind} className={i === items.length - 1 && items.length % 2 === 1 ? "col-span-2" : undefined}>
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

/**
 * 광장 꾸미기 (사용자 요청 2026-10-09): 자리를 고르면 캐릭터가 그 앞으로 가고, 가진 장식을 골라 놓거나 비운다.
 * 자리는 집 단계만큼 열린다 (4/6/8). 열려 있는 동안 광장에 자리 번호가 보인다 (townBus "deco-mode")
 */
function DecoPanel({
  data,
  member,
  decorations,
  onChange,
}: {
  data: TownData;
  member: TownHudMember;
  decorations: TownDecoration[];
  onChange: (list: TownDecoration[]) => void;
}) {
  const [slot, setSlot] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    townBus.emit("deco-mode", true);
    return () => townBus.emit("deco-mode", false);
  }, []);

  const at = (i: number) => decorations.find((d) => d.slot === i);
  const nameOf = (assetKey: string) => member.decos.find((d) => d.assetKey === assetKey)?.name ?? "장식";
  const choose = (i: number) => {
    setSlot(i);
    setMessage(null);
    townBus.emit("teleport", `deco:${i}`);
  };
  const place = (target: number, itemId: number | null) =>
    start(async () => {
      const r = await placeDecoration(target, itemId);
      if (!r.ok) {
        setMessage({ ok: false, text: r.error });
        return;
      }
      onChange(r.decorations);
      setMessage({ ok: true, text: itemId === null ? `${target + 1}번 자리를 비웠어요.` : `${target + 1}번 자리에 놓았어요 ✓` });
    });

  return (
    <div className="space-y-3" data-deco-panel>
      <p className="px-1 text-sm text-ink-soft">
        자리를 고르면 그 앞으로 가요. 집이 커질수록 자리가 늘어요 ({data.decoSlots}/{MAX_DECO_SLOTS}자리)
      </p>
      <ol className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: MAX_DECO_SLOTS }, (_, i) => {
          const open = i < data.decoSlots;
          const d = at(i);
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!open}
                onClick={() => choose(i)}
                aria-pressed={slot === i}
                aria-label={open ? `${i + 1}번 자리${d ? `: ${nameOf(d.assetKey)}` : " (비어 있음)"}` : `${i + 1}번 자리 (Lv.${decoSlotLevel(i)}에 열려요)`}
                data-deco-slot={i}
                className={`flex h-16 w-full flex-col items-center justify-center rounded-xl border-2 text-xs focus-visible:outline-2 focus-visible:outline-sky disabled:cursor-not-allowed disabled:opacity-60 ${
                  slot === i ? "border-sun bg-[#fff3d6]" : "border-line bg-white hover:bg-cream"
                }`}
              >
                {d ? (
                  <ItemArt type="deco" assetKey={d.assetKey} className="h-9 w-12" characterSize={36} />
                ) : (
                  <span className="text-lg" aria-hidden>
                    {open ? "＋" : "🔒"}
                  </span>
                )}
                <span className="font-bold">{open ? `${i + 1}번` : `Lv.${decoSlotLevel(i)}`}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-sm font-bold ${message.ok ? "bg-[#e9f6e4] text-leaf-dark" : "bg-[#ffe4e4] text-berry"}`}>
          {message.text}
        </p>
      )}
      {slot !== null && (
        <div>
          <h3 className="px-1 pb-1 text-sm font-bold">{slot + 1}번 자리에 놓을 장식</h3>
          {member.decos.length === 0 ? (
            <p className="rounded-xl bg-cream px-3 py-3 text-center text-sm">
              아직 장식이 없어요.{" "}
              <Link href="/shop" className="font-bold underline">
                상점
              </Link>
              의 🌷 광장 장식에서 사 보세요.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-1.5">
              {member.decos.map((d) => {
                const where = decorations.find((x) => x.assetKey === d.assetKey);
                const here = where?.slot === slot;
                return (
                  <li key={d.itemId}>
                    <button
                      type="button"
                      disabled={pending || here}
                      onClick={() => place(slot, d.itemId)}
                      data-deco-item={d.assetKey}
                      className="flex w-full flex-col items-center rounded-xl border-2 border-line bg-white p-1.5 text-xs hover:bg-cream focus-visible:outline-2 focus-visible:outline-sky disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ItemArt type="deco" assetKey={d.assetKey} className="h-12 w-full" characterSize={44} />
                      <span className="mt-1 line-clamp-1 font-bold">{d.name}</span>
                      <span className="text-[11px] text-ink-soft">{here ? "놓여 있어요" : where ? `${where.slot + 1}번에서 옮기기` : "놓기"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {at(slot) && (
            <button type="button" disabled={pending} onClick={() => place(slot, null)} className="btn mt-2 w-full bg-white text-sm" data-deco-clear>
              🧹 이 자리 비우기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
