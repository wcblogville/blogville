import type { NextRequest } from "next/server";
import { itemArtSize, itemArtSvg } from "@/lib/art/item-src";

// 아이템 그림 SVG (ItemArt가 <img src="/px/item/furniture/chair?s=96&v=…">로 부른다). v가 그림 해시라 오래 캐시한다
export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string; key: string }> }) {
  const { type, key } = await params;
  const size = itemArtSize(req.nextUrl.searchParams.get("s"));
  const svg = size === null ? null : itemArtSvg(type, decodeURIComponent(key), size);
  if (!svg) return new Response("Not found", { status: 404 });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
