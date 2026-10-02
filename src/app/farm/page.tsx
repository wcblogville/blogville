import { requireMember } from "@/server/dal";

export const metadata = { title: "동물 농장" };

// 동물 농장 (준비 중). 동물을 키워 경험치를 얻고 레벨업하는 곳이 될 예정이다.
export default async function FarmPage() {
  await requireMember();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-center">
      <p className="text-6xl">🐮🐔🐷</p>
      <h1 className="mt-4 font-display text-4xl">동물 농장</h1>
      <div className="card mt-6 p-6">
        <p className="text-lg font-bold">🚧 아직 공사 중이에요</p>
        <p className="mt-2 text-ink-soft">
          곧 이곳에서 동물을 키울 수 있어요. 동물을 돌보고 키워 내면 경험치를 얻고 레벨이 올라가요.
        </p>
      </div>
    </div>
  );
}
