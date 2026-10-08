// Better Auth HTTP 경로: 허용 목록만 라이브러리로 넘기고 나머지는 빈 본문 404 (AUTH-01 / FR-007, FR-011, FR-028, FR-041, research R5)
// 가입·로그인·연동·해제·탈퇴는 우리 Server Action이 서버에서 auth.api.*를 부른다 (서버 호출은 이 라우트를 거치지 않는다).
// 금지 목록이 아니라 허용 목록이라, 라이브러리를 올려 새 경로가 생겨도 기본으로 닫힌다.
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);
const BASE = "/api/auth";

const ALLOWED: Record<"GET" | "POST", RegExp[]> = {
  GET: [
    /^\/get-session$/, // SessionKeeper의 로그인 유지 연장 (8단계)
    /^\/callback\/(google|kakao|naver)$/, // 소셜 로그인·연동에서 돌아오는 곳
    /^\/error$/, // 라이브러리 오류 화면 (안전망)
  ],
  POST: [
    /^\/callback\/(google|kakao|naver)$/,
    // 1단계 동안만 임시: 첫 화면 소셜 버튼이 아직 authClient.signIn.social을 쓴다. 8단계 startSocialSignIn(Server Action)으로 바꾸며 뺀다
    /^\/sign-in\/social$/,
    // 1단계 동안만 임시: 헤더 로그아웃 버튼(sign-out-button.tsx)이 아직 authClient.signOut을 쓴다.
    // 계약(contracts/auth-entry.md 6장)은 404지만, 로그아웃을 Server Action으로 바꾸는 작업(T032·T033)이 다음 단계라
    // 막으면 로그아웃이 깨진다. 자기 세션만 지우는 경로라 위험이 없다. T033에서 뺀다
    /^\/sign-out$/,
  ],
};

function allowed(method: "GET" | "POST", request: Request) {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(`${BASE}/`)) return false;
  const path = pathname.slice(BASE.length).replace(/\/+$/, "");
  return ALLOWED[method].some((re) => re.test(path));
}

const notFound = () => new Response(null, { status: 404 });

export async function GET(request: Request) {
  return allowed("GET", request) ? handler.GET(request) : notFound();
}

export async function POST(request: Request) {
  return allowed("POST", request) ? handler.POST(request) : notFound();
}
