// 방문자 쿠키 bv_visitor (BLOG-06 방문자 수, POST-06 조회수 / FR-046, research R3).
// 무작위 UUID라 회원 정보와 잇지 않고 IP도 저장하지 않는다
import "server-only";
import { cookies } from "next/headers";

const VISITOR_COOKIE = "bv_visitor";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 쿠키 값이 UUID 형식이면 그 값, 아니면 null (서버 컴포넌트에서도 부를 수 있다) */
export async function readVisitorId(): Promise<string | null> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value ?? "";
  return UUID_RE.test(value) ? value : null;
}

/** 없거나 형식이 틀리면 새 UUID로 쿠키를 심는다. 쿠키를 쓰므로 Server Action·Route Handler에서만 부른다 */
export async function ensureVisitorId(): Promise<string> {
  const existing = await readVisitorId();
  if (existing) return existing;
  const visitorId = crypto.randomUUID();
  (await cookies()).set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  return visitorId;
}
