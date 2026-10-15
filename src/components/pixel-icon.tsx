import { ICON, iconSrc, type IconName } from "@/lib/art/icons";

/**
 * 도트 아이콘 (12칸 그림을 정수배로). 꾸밈 그림이라 기본은 화면 읽기에서 숨긴다 (aria-hidden, alt="").
 * 뜻을 전해야 하면 label을 주면 그 이름으로 읽힌다. scale 2 = 24px, 3 = 36px
 */
export function PixelIcon({ name, scale = 2, label, className = "" }: { name: IconName; scale?: number; label?: string; className?: string }) {
  const size = ICON * scale;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 도트 SVG (/px/<이름>, 한 번 받아 캐시)
    <img
      src={iconSrc(name)}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      className={`pixelated inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * 도트 아이콘 + 글자 한 줄 (그림 글자 "🪙 120" 대신, 2026-10-12 "선물이나 코인이나 다 도트로").
 * 아이콘은 꾸밈이라 화면 읽기에는 글자만 읽힌다. 글자가 없는 숫자 옆이면 label로 뜻을 준다 (예: label="코인")
 */
export function IconText({
  icon,
  children,
  scale = 1,
  label,
  className = "",
}: {
  icon: IconName;
  children?: React.ReactNode;
  scale?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      <PixelIcon name={icon} scale={scale} label={label} />
      {children}
    </span>
  );
}
