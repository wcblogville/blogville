"use client"; // 오류 화면(Error Boundary)은 클라이언트 컴포넌트여야 한다

import { useEffect } from "react";
import "./globals.css";

/**
 * 루트 레이아웃(헤더 포함)에서 오류가 나면 레이아웃 전체를 대신한다 (NF-19).
 * 레이아웃이 없으므로 <html>·<body>와 스타일을 직접 넣는다. 글꼴은 기기 기본 글꼴로 보인다
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center px-4 text-center">
        <title>문제가 생겼어요 | Blogville</title>
        <p className="text-7xl">🚧</p>
        <h1 className="mt-4 text-3xl font-bold">잠깐 문제가 생겼어요</h1>
        <p className="mt-2 max-w-md text-ink-soft">
          마을에 예상하지 못한 문제가 생겼어요. [다시 시도]를 눌러 보고, 계속되면 잠시 뒤에 다시 들러 주세요.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="btn bg-leaf text-white">
            다시 시도
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 레이아웃이 망가진 상태라 Link 대신 페이지를 새로 연다 */}
          <a href="/town" className="btn bg-white text-ink">
            광장으로 돌아가기
          </a>
        </div>
        {error.digest && <p className="mt-6 text-xs text-ink-soft">오류 번호: {error.digest}</p>}
      </body>
    </html>
  );
}
