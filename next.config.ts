import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버에서는 nginx가 앞에서 요청을 넘겨준다. nginx가 Host를 자기 주소로 바꿔 넘기면
  // Server Action의 출처 검사(Origin ↔ Host)가 막으므로, 사이트 주소를 허용 목록에 둔다.
  experimental: {
    serverActions: {
      allowedOrigins: ["wcblogville.java21.net"],
    },
  },
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
