"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { PHONE_MEDIA } from "@/lib/device";
import type { TownData, TownTarget } from "./types";

export function TownGame({ data, className = "" }: { data: TownData; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let starting = false;
    let cancelled = false;
    // 휴대폰에서는 광장을 띄우지 않고 간단 메뉴(TownMenu)를 쓴다
    const phone = window.matchMedia(PHONE_MEDIA);

    const onEnter = (target: TownTarget) => {
      router.push(target.kind === "link" ? target.href : "/");
    };

    // Phaser는 window가 필요해서 브라우저에서만 불러온다
    const start = async () => {
      if (game || starting) return;
      starting = true;
      const Phaser = (await import("phaser")).default;
      const { createTownScene, townTextures } = await import("./scene");
      // 광장 그림(SVG)을 미리 이미지로 불러 둔다. 글꼴도 준비된 뒤에 글자를 그린다
      const images = new Map<string, HTMLImageElement>();
      await Promise.all([
        document.fonts.ready,
        ...townTextures(data).map(async ({ key, uri }) => {
          const img = new Image();
          img.src = uri;
          await img.decode();
          images.set(key, img);
        }),
      ]);
      starting = false;
      // 불러오는 동안 화면을 떠났거나 휴대폰 화면으로 바뀌었으면 만들지 않는다
      if (cancelled || phone.matches || !containerRef.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: "#8fd18a",
        physics: { default: "arcade", arcade: { debug: false } },
        scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
        scene: createTownScene(Phaser, data, images, onEnter, getComputedStyle(document.body).fontFamily),
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
      phone.removeEventListener("change", sync);
      stop();
    };
    // 광장 데이터가 바뀌면(새 이웃 등) 게임을 다시 만든다
  }, [data, router]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden bg-[#8fd18a] ${className}`}
      aria-label="중앙 광장. 방향키나 WASD로 움직이고 Space로 건물에 들어갑니다."
    />
  );
}
