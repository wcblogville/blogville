"use client";

// 로그인 유지 세션의 7일 연장 (AUTH-09 / FR-021, research R6-6)
// 헤더가 유지 세션(remember_me = true)일 때만 그린다. 유지 안 함 세션에서 부르면 라이브러리가 쿠키에 Max-Age 7일을 다시 심기 때문이다.
// GET /api/auth/get-session은 Route Handler라 라이브러리가 DB 만료(1시간 단위로 다시 7일)와 쿠키 Max-Age를 함께 늘린다.
// (Server Component의 getSession()은 쿠키를 쓸 수 없어 연장을 끈다, src/server/dal.ts)
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

const KEY = "bv_session_kept_at";
const INTERVAL_MS = 10 * 60 * 1000; // 10분에 한 번까지만

function keep() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < INTERVAL_MS) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // 저장소를 쓸 수 없으면(사생활 보호 모드 등) 그냥 부른다. 라이브러리가 1시간 단위로만 DB를 쓴다
  }
  void authClient.getSession().catch(() => {});
}

export function SessionKeeper() {
  useEffect(() => {
    keep();
    const onVisible = () => document.visibilityState === "visible" && keep();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
