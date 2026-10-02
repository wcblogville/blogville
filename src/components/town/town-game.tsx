"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { TownData, TownTarget } from "./types";

export function TownGame({ data }: { data: TownData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let cancelled = false;

    const onEnter = (target: TownTarget) => {
      router.push(target.kind === "link" ? target.href : "/");
    };

    // Phaser는 window가 필요해서 브라우저에서만 불러온다
    (async () => {
      const Phaser = (await import("phaser")).default;
      const { createTownScene } = await import("./scene");
      await document.fonts.ready; // 글꼴이 준비된 뒤에 글자를 그린다
      if (cancelled || !containerRef.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: "#8fd18a",
        physics: { default: "arcade", arcade: { debug: false } },
        scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
        scene: createTownScene(Phaser, data, onEnter, getComputedStyle(document.body).fontFamily),
      });
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
    // 광장 데이터가 바뀌면(새 이웃 등) 게임을 다시 만든다
  }, [data, router]);

  return (
    <div
      ref={containerRef}
      className="h-[68vh] min-h-[420px] w-full overflow-hidden rounded-2xl border-2 border-line bg-[#8fd18a]"
      aria-label="중앙 광장. 방향키나 WASD로 움직이고 Space로 건물에 들어갑니다."
    />
  );
}
