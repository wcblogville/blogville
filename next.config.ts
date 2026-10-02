import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 블로그 주소는 /@slug 형식. `@`로 시작하는 폴더는 Next.js에서 특별한 의미(parallel route)라서
  // 실제 페이지는 /blog/[slug]에 두고 주소만 바꿔 보여준다.
  async rewrites() {
    return [
      { source: "/@:slug", destination: "/blog/:slug" },
      { source: "/@:slug/:postId", destination: "/blog/:slug/:postId" },
    ];
  },
};

export default nextConfig;
