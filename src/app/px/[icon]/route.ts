import { ICON_NAMES, iconSvg, type IconName } from "@/lib/art/icons";

// 도트 아이콘 SVG (PixelIcon이 <img src="/px/coin?v=…">로 부른다). 주소의 v가 그림 해시라 바뀌지 않는 파일로 오래 캐시한다
export function generateStaticParams() {
  return ICON_NAMES.map((icon) => ({ icon }));
}

export const dynamicParams = false;

export async function GET(_req: Request, { params }: { params: Promise<{ icon: string }> }) {
  const { icon } = await params;
  if (!(ICON_NAMES as string[]).includes(icon)) return new Response("Not found", { status: 404 });
  return new Response(iconSvg(icon as IconName), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
