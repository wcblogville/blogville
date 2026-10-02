// 첨부 파일 저장소. 지금은 서버 디스크(UPLOAD_DIR, 기본 storage/uploads)에 둔다.
// 배포 서비스가 정해지면(NF-08) 이 파일만 바꿔서 Vercel Blob 같은 저장소로 옮긴다 (POST-07 열린 질문)
import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { ATTACHMENT_KEY_RE } from "@/lib/attachments";

const ROOT = path.resolve(process.env.UPLOAD_DIR || "storage/uploads");

function filePath(key: string) {
  // 키는 서버가 만든 32자 16진수뿐이라 경로를 벗어날 수 없지만, 한 번 더 막는다
  if (!ATTACHMENT_KEY_RE.test(key)) throw new Error("잘못된 파일 키");
  return path.join(ROOT, key);
}

/** 새 파일 저장. 같은 키가 이미 있으면 덮어쓰지 않고 실패한다 */
export async function saveAttachment(key: string, bytes: Uint8Array) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(filePath(key), bytes, { flag: "wx" });
}

/** 파일 내용을 스트림으로. 없으면 null */
export async function openAttachment(key: string): Promise<ReadableStream | null> {
  const p = filePath(key);
  try {
    await stat(p);
  } catch {
    return null;
  }
  return Readable.toWeb(createReadStream(p)) as ReadableStream;
}
