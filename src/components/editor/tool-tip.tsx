/** 마우스를 올리거나 키보드로 고르면 곧바로 뜨는 말풍선 (브라우저 title 말풍선은 늦게 뜨고 휴대폰에 없다) */
export function ToolTip({ title, hint, keys }: { title: string; hint: string; keys?: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-max max-w-56 whitespace-normal bg-ink px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-white shadow-[3px_3px_0_0_#0000003d] group-hover:block group-focus-visible:block"
    >
      <b className="font-bold text-[#ffd36e]">{title}</b> · {hint}
      {keys && <span className="mt-0.5 block font-mono text-[11px] text-white/70">{keys}</span>}
    </span>
  );
}
