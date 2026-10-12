"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { lookKey } from "@/lib/art/characters";
import { PHONE_MEDIA } from "@/lib/device";
import { PIXEL } from "@/lib/art/pixel";
import { gradePixels, snowCapPixels, townTheme, type TownTheme } from "@/lib/art/town-theme";
import { townBus } from "./bus";
import type { TownData, TownTarget } from "./types";

export function TownGame({
  data: fresh,
  startAt = null,
  className = "",
}: {
  data: TownData;
  /** 처음 설 곳 (townSpots의 key). 없으면 광장 아래쪽 */
  startAt?: string | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // 서버가 다시 그려도(⭐ 즐겨찾기 등) 내용이 같으면 게임을 다시 만들지 않는다
  const key = JSON.stringify(fresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => fresh, [key]);

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let starting = false;
    let cancelled = false;
    // 휴대폰에서는 광장을 띄우지 않고 간단 메뉴(TownMenu)를 쓴다
    const phone = window.matchMedia(PHONE_MEDIA);

    const onEnter = (target: TownTarget) => {
      if (target.kind === "link") router.push(target.href);
      else if (target.kind === "login") router.push("/");
      else townBus.emit("open", target);
    };
    // 메뉴에서 고른 곳으로 순간 이동.
    // 메뉴 창이 열려 있어도 방향키·WASD로 걸을 수 있다 (사용자 요청 2026-10-12 "메뉴 떠 있는 상태에서 방향키랑 wasd가 안 먹는데").
    // 다만 창 안의 버튼·목록이 키를 쓸 수 있게 키 기본 동작은 막지 않는다 (버튼 위 Enter·Space와 글자 칸은 아래 yieldKeys가 양보)
    const offTeleport = townBus.on("teleport", (spot) => game?.events.emit("teleport", spot));
    const offPanel = townBus.on("panel", (open) => {
      const keyboard = game?.scene.getScene("town")?.input.keyboard;
      if (!keyboard) return;
      keyboard.enabled = true;
      if (open) keyboard.disableGlobalCapture();
      else keyboard.enableGlobalCapture();
    });
    // Phaser는 window에서 키를 받아 Enter·Space·방향키를 막는다(preventDefault). 그러면 Tab으로 고른 [☰ 메뉴]가
    // Enter·Space로 열리지 않는다 (NF-18). 버튼·링크를 Enter·Space로 누를 때와 글자 칸에서는 그 키를 게임에 주지 않는다.
    // capture 단계라 Phaser(bubble)보다 먼저 정한다
    const yieldKeys = (e: KeyboardEvent) => {
      const keyboard = game?.input.keyboard;
      if (!keyboard) return;
      const el = e.target instanceof Element ? e.target : null;
      const typing = !!el?.closest("input, textarea, select, [contenteditable]");
      const pressing = (e.key === "Enter" || e.key === " ") && !!el?.closest("button, a[href], summary, [role='button']");
      keyboard.enabled = !typing && !pressing;
      // 글자 칸으로 옮겨 가는 사이 놓은 방향키가 눌린 채로 남지 않게
      if (typing) game?.scene.getScene("town")?.input.keyboard?.resetKeys();
    };
    window.addEventListener("keydown", yieldKeys, true);
    window.addEventListener("keyup", yieldKeys, true);

    // Phaser는 window가 필요해서 브라우저에서만 불러온다
    const start = async () => {
      if (game || starting) return;
      starting = true;
      const Phaser = (await import("phaser")).default;
      const { createTownScene, townTextures } = await import("./scene");
      // 광장 그림(SVG)을 미리 이미지로 불러 둔다. 글꼴도 준비된 뒤에 글자를 그린다
      // 마을 테마(꾸미기 배경)에 맞춰 칸마다 색을 입히고, 눈 테마면 건물·나무 윗면에 눈을 얹는다
      const theme = townTheme(data.theme);
      const images = new Map<string, HTMLImageElement>();
      await Promise.all([
        document.fonts.ready,
        ...townTextures(data).map(async ({ key, uri, kind }) => {
          // 안내 말풍선 아이콘(ui)은 화면 글자처럼 테마 색을 입히지 않는다
          images.set(key, await rasterize(uri, kind !== "ui" && (theme.grade || theme.snow) ? (px, w, h) => themePixels(px, w, h, kind, theme) : undefined));
        }),
      ]);
      starting = false;
      // 불러오는 동안 화면을 떠났거나 휴대폰 화면으로 바뀌었으면 만들지 않는다
      if (cancelled || phone.matches || !containerRef.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: townTheme(data.theme).bg,
        // 도트 그림: 키울 때 가까운 픽셀을 써서 흐려지지 않게, 위치는 정수 픽셀로 맞춘다
        pixelArt: true,
        roundPixels: true,
        physics: { default: "arcade", arcade: { debug: false } },
        scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
        scene: createTownScene(Phaser, data, images, onEnter, getComputedStyle(document.body).fontFamily, startAt),
      });
    };
    const stop = () => {
      game?.destroy(true);
      game = null;
    };

    // 화면을 돌리거나 창 크기가 바뀌어 휴대폰 화면이 되면 광장을 끄고, 벗어나면 다시 켠다
    const sync = () => (phone.matches ? stop() : void start());
    sync();
    phone.addEventListener("change", sync);

    return () => {
      cancelled = true;
      offTeleport();
      offPanel();
      window.removeEventListener("keydown", yieldKeys, true);
      window.removeEventListener("keyup", yieldKeys, true);
      phone.removeEventListener("change", sync);
      stop();
    };
    // 광장 데이터가 바뀌면(새 이웃 등) 게임을 다시 만든다
  }, [data, router, startAt]);

  return (
    <div
      ref={containerRef}
      data-player-look={data.player ? lookKey(data.player.characterAsset, data.player.outfit) : undefined}
      data-town-host={data.host?.slug}
      data-town-theme={townTheme(data.theme).key}
      style={{ backgroundColor: townTheme(data.theme).bg }}
      className={`overflow-hidden ${className}`}
      aria-label={`${data.host ? `${data.host.nickname}님의 마을` : "중앙 광장"}. 방향키나 WASD로 움직이고 Space로 건물에 들어갑니다.`}
    />
  );
}

/**
 * SVG 그림을 그 크기(width·height) 그대로 PNG로 굽는다.
 * 브라우저에 따라 SVG를 Phaser 텍스처로 올릴 때 작게 그려 왼쪽 위로 쏠리는 일이 있어
 * (2026-10-12 사용자 제보: 마을의 내 집이 작아지고 그림자·이름표에서 떨어져 보임) 크기를 못 박은 PNG로 넘긴다.
 */
async function rasterize(uri: string, edit?: (px: Uint8ClampedArray, w: number, h: number) => void): Promise<HTMLImageElement> {
  const svg = new Image();
  svg.src = uri;
  await svg.decode();
  const size = /<svg[^>]*?\swidth='(\d+)'[^>]*?\sheight='(\d+)'/.exec(decodeURIComponent(uri));
  const w = size ? Number(size[1]) : svg.naturalWidth;
  const h = size ? Number(size[2]) : svg.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx || !w || !h) return svg;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(svg, 0, 0, w, h);
  if (edit) {
    const img = ctx.getImageData(0, 0, w, h);
    edit(img.data, w, h);
    ctx.putImageData(img, 0, 0);
  }
  const png = new Image();
  png.src = canvas.toDataURL("image/png");
  await png.decode();
  return png;
}

/** 마을 테마 입히기: 건물·나무는 테마 색(눈 테마면 윗면에 눈 먼저), 캐릭터·동물은 약하게 */
function themePixels(px: Uint8ClampedArray, w: number, h: number, kind: "world" | "plain" | "character" | "ui", theme: TownTheme) {
  if (kind === "character") return gradePixels(px, theme.grade, theme.charStrength);
  if (kind === "world" && theme.snow) snowCapPixels(px, w, h, PIXEL);
  gradePixels(px, theme.grade);
}
