import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="text-7xl">🧭</p>
      <h1 className="mt-4 font-display text-3xl">길을 잃었어요</h1>
      <p className="mt-2 text-ink-soft">찾는 블로그나 글이 없거나, 비공개 글이에요.</p>
      <Link href="/town" className="btn mt-6 bg-leaf text-white">
        광장으로 돌아가기
      </Link>
    </div>
  );
}
