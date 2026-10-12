import { type AnimalSex, SEX_LABEL, SEX_MARK } from "@/lib/farm";

/** 동물 암수 표시 ♀/♂ (2026-10-12). 글자 대비 4.5:1 이상 (암컷 berry, 수컷 짙은 파랑), 화면 읽기 프로그램은 "암컷"/"수컷" */
export function SexMark({ sex, label = false, className = "" }: { sex: AnimalSex | null | undefined; label?: boolean; className?: string }) {
  if (!sex) return null;
  return (
    <span data-sex={sex} title={SEX_LABEL[sex]} className={`font-sans font-bold ${sex === "female" ? "text-berry" : "text-[#2f62a8]"} ${className}`}>
      <span aria-hidden>{SEX_MARK[sex]}</span>
      {label ? <span className="ml-0.5 text-xs">{SEX_LABEL[sex]}</span> : <span className="sr-only">{SEX_LABEL[sex]}</span>}
    </span>
  );
}
