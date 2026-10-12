import { ICON, iconDataUri, type IconName } from "@/lib/art/icons";

/**
 * 도트 아이콘 (12칸 그림을 정수배로). 꾸밈 그림이라 기본은 화면 읽기에서 숨긴다 (aria-hidden, alt="").
 * 뜻을 전해야 하면 label을 주면 그 이름으로 읽힌다. scale 2 = 24px, 3 = 36px
 */
export function PixelIcon({ name, scale = 2, label, className = "" }: { name: IconName; scale?: number; label?: string; className?: string }) {
  const size = ICON * scale;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
    <img
      src={iconDataUri(name, scale)}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      className={`pixelated inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
