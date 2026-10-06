"use client"; // 오류 화면(Error Boundary)은 클라이언트 컴포넌트여야 한다

import Link from "next/link";
import { useEffect } from "react";

/** 페이지에서 예상하지 못한 오류가 나면 Next.js 기본 화면 대신 보여준다 (NF-19). 헤더는 그대로 남는다 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <title>문제가 생겼어요 | Blogville</title>
      <p className="text-7xl">🚧</p>
      <h1 className="mt-4 font-display text-3xl">잠깐 문제가 생겼어요</h1>
      <p className="mt-2 text-ink-soft">
        마을에 예상하지 못한 문제가 생겼어요. [다시 시도]를 눌러 보고, 계속되면 잠시 뒤에 다시 들러 주세요.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn bg-leaf text-white">
          다시 시도
        </button>
        <Link href="/town" className="btn bg-white text-ink">
          광장으로 돌아가기
        </Link>
      </div>
      {/* 서버 기록에서 같은 오류를 찾을 때 쓰는 번호 (오류 내용 자체는 보여주지 않는다) */}
      {error.digest && <p className="mt-6 text-xs text-ink-soft">오류 번호: {error.digest}</p>}
    </div>
  );
}
