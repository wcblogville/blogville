// 첨부 파일 저장소. 지금은 서버 디스크(UPLOAD_DIR, 기본 storage/uploads)에 둔다.
// 배포 서비스가 정해지면(NF-08) 이 파일만 바꿔서 Vercel Blob 같은 저장소로 옮긴다 (POST-07 열린 질문)
import "server-only";
import { constants as fsConstants, createReadStream } from "node:fs";
import { copyFile, mkdir, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
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

/** 같은 저장소 안에서 복사 (붙여 넣기 다시 올리기, research R8). 대상이 있으면 실패. 복사본 수정 시각은 지금 (R10) */
export async function copyAttachment(fromKey: string, toKey: string) {
  await mkdir(ROOT, { recursive: true });
  await copyFile(filePath(fromKey), filePath(toKey), fsConstants.COPYFILE_EXCL);
  const now = new Date();
  await utimes(filePath(toKey), now, now);
}

/** 파일 삭제. 없으면 조용히 넘어간다 (정리 작업) */
export async function deleteAttachment(key: string) {
  await rm(filePath(key), { force: true });
}

/** 저장소의 파일 목록 (키 형식에 맞는 이름만, 정리 작업의 "주인 없는 파일" 찾기) */
export async function listStoredFiles(): Promise<{ key: string; modifiedAt: Date }[]> {
  let names: string[];
  try {
    names = await readdir(ROOT);
  } catch {
    return [];
  }
  const out: { key: string; modifiedAt: Date }[] = [];
  for (const key of names) {
    if (!ATTACHMENT_KEY_RE.test(key)) continue;
    try {
      out.push({ key, modifiedAt: (await stat(filePath(key))).mtime });
    } catch {
      // 그사이 지워진 파일
    }
  }
  return out;
}

/** 저장소에 파일이 있나 (304 응답 전 확인) */
export async function attachmentExists(key: string) {
  try {
    await stat(filePath(key));
    return true;
  } catch {
    return false;
  }
}
