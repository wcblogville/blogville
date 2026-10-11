// 광장 게임(TownGame)과 화면 위 메뉴(TownHud)가 주고받는 신호. 둘은 같은 페이지의 형제 컴포넌트라 모듈 하나로 잇는다
import type { TownTarget } from "./types";

type TownEvents = {
  /** 메뉴에서 고른 곳(townSpots의 key)으로 순간 이동 */
  teleport: string;
  /** 광장에서 우체통에 들어감 → 메뉴가 소식을 연다. 빈 집터 → 이웃 집 자리 고르기 창 (TOWN-18) */
  open: Extract<TownTarget, { kind: "mailbox" | "lot" }>;
  /** 메뉴 창이 열렸는지. 열려 있는 동안 게임은 키보드를 쓰지 않는다 (Space로 버튼을 누를 수 있게) */
  panel: boolean;
};

const target = typeof window === "undefined" ? null : new EventTarget();

export const townBus = {
  emit<K extends keyof TownEvents>(type: K, detail: TownEvents[K]) {
    target?.dispatchEvent(new CustomEvent(type, { detail }));
  },
  on<K extends keyof TownEvents>(type: K, listener: (detail: TownEvents[K]) => void) {
    const handler = (e: Event) => listener((e as CustomEvent<TownEvents[K]>).detail);
    target?.addEventListener(type, handler);
    return () => target?.removeEventListener(type, handler);
  },
};
