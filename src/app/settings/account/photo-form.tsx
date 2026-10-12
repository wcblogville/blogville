"use client";

// 회원정보 수정의 프로필 사진 칸: [사진 올리기]로 고른 사진을 /api/uploads에 올리고 setProfilePhoto로 건다.
// 사진은 블로그 제목 줄·블로그 찾기·☰ 메뉴 프로필에 캐릭터 얼굴 대신 보인다 (OwnerAvatar)
import { useRef, useState, useTransition } from "react";
import { OwnerAvatar } from "@/components/blog/blog-header";
import { ATTACH_MESSAGES, attachmentKind, attachmentProblem, IMAGE_TYPES } from "@/lib/attachments";
import { removeProfilePhoto, setProfilePhoto } from "./photo-actions";

const ACCEPT = Object.keys(IMAGE_TYPES).map((e) => `.${e}`).join(",");

export function PhotoForm({ photoKey, characterAsset, outfit, nickname }: { photoKey: string | null; characterAsset: string; outfit?: string[]; nickname: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function upload(file: File) {
    const problem = attachmentKind(file.name) === "image" ? attachmentProblem(file.name, file.size) : ATTACH_MESSAGES.notImage;
    if (problem) {
      setMessage({ ok: false, text: problem });
      return;
    }
    start(async () => {
      setMessage(null);
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch("/api/uploads", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.key !== "string") {
          setMessage({ ok: false, text: data.error ?? ATTACH_MESSAGES.failed });
          return;
        }
        const r = await setProfilePhoto(data.key);
        setMessage(r.error ? { ok: false, text: r.error } : { ok: true, text: "프로필 사진을 바꿨어요 ✓" });
      } catch {
        setMessage({ ok: false, text: ATTACH_MESSAGES.failed });
      }
    });
  }

  function remove() {
    if (!confirm("프로필 사진을 지울까요? 다시 캐릭터 얼굴이 보여요")) return;
    start(async () => {
      await removeProfilePhoto();
      setMessage({ ok: true, text: "프로필 사진을 지웠어요" });
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 px-[3px]">
      <span className="pixel-slot grid place-items-center p-2" data-profile-photo={photoKey ? "photo" : "character"}>
        <OwnerAvatar photoKey={photoKey} characterAsset={characterAsset} outfit={outfit} nickname={nickname} size={72} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-xs text-ink-soft">PNG·JPG·GIF·WEBP 사진, 10MB까지. 사진이 없으면 캐릭터 얼굴이 보여요.</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-label="프로필 사진 파일"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => input.current?.click()}
            className="pixel-btn pixel-btn-sm min-w-11 whitespace-nowrap bg-leaf px-4 text-white"
          >
            {pending ? "처리하는 중..." : photoKey ? "사진 바꾸기" : "사진 올리기"}
          </button>
          {photoKey && (
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="pixel-btn pixel-btn-sm min-w-11 whitespace-nowrap bg-[#fffaf0] px-4 text-berry"
            >
              사진 지우기
            </button>
          )}
        </div>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-leaf-dark" : "font-bold text-berry"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
