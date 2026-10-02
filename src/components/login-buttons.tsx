"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Providers = { google: boolean; kakao: boolean; naver: boolean };

const SOCIAL = [
  { id: "kakao", label: "카카오로 시작하기", className: "bg-[#FEE500] text-[#191919]" },
  { id: "naver", label: "네이버로 시작하기", className: "bg-[#03C75A] text-white" },
  { id: "google", label: "Google로 시작하기", className: "bg-white text-ink border-2 border-line" },
] as const;

export function LoginButtons({ providers, devLogin }: { providers: Providers; devLogin: boolean }) {
  const router = useRouter();
  const [devId, setDevId] = useState("tester1");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // 개발용: 같은 아이디면 같은 계정으로 로그인, 처음이면 새로 만든다
  async function signInDev() {
    setPending(true);
    setError("");
    const email = `${devId.trim().toLowerCase()}@dev.blogville.local`;
    const password = "dev-password-1234";
    const signIn = await authClient.signIn.email({ email, password });
    if (signIn.error) {
      const signUp = await authClient.signUp.email({ email, password, name: devId.trim() });
      if (signUp.error) {
        setError(signUp.error.message ?? "로그인하지 못했어요");
        setPending(false);
        return;
      }
    }
    router.push("/town");
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {SOCIAL.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={!providers[p.id]}
          title={providers[p.id] ? undefined : "아직 키가 설정되지 않았어요"}
          className={`btn w-full py-3 ${p.className}`}
          onClick={() => authClient.signIn.social({ provider: p.id, callbackURL: "/town" })}
        >
          {p.label}
        </button>
      ))}

      {devLogin && (
        <div className="mt-3 rounded-2xl border-2 border-dashed border-line p-4">
          <p className="mb-2 text-sm font-bold text-ink-soft">🛠 개발용 로그인 (배포 환경에서는 보이지 않아요)</p>
          <div className="flex gap-2">
            <input
              value={devId}
              onChange={(e) => setDevId(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-3 py-2"
              aria-label="개발용 아이디"
            />
            <button
              type="button"
              disabled={pending || !/^[a-z0-9_]{2,20}$/i.test(devId.trim())}
              onClick={signInDev}
              className="btn bg-ink text-cream"
            >
              입장
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-berry">{error}</p>}
        </div>
      )}
    </div>
  );
}
