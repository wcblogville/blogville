import type { Metadata } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// 제목용 동글동글한 글꼴 + 본문용 읽기 편한 글꼴
const jua = Jua({ weight: "400", variable: "--font-jua", preload: false });
const noto = Noto_Sans_KR({ variable: "--font-noto", preload: false });

export const metadata: Metadata = {
  title: { default: "Blogville", template: "%s | Blogville" },
  description: "글을 쓰고 꾸미면서 캐릭터와 블로그를 키우는 블로그 마을",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${jua.variable} ${noto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t-2 border-line py-6 text-center text-sm text-ink-soft">
          Blogville · AI응용프로젝트
        </footer>
      </body>
    </html>
  );
}
