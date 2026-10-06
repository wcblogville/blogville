// 글 첨부 올리기 (POST-07 사진, POST-09 파일): 파일 하나씩 받아 저장하고 주소를 돌려준다.
// 30MB까지 받아야 해서 1MB 상한이 있는 Server Action 대신 Route Handler를 쓴다.
// 그래서 Server Action이 해 주던 출처(Origin) 확인과 회원 확인을 여기서 직접 한다
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import {
  ATTACH_MESSAGES,
  attachmentKind,
  attachmentProblem,
  attachmentUrl,
  cleanFileName,
  extensionOf,
  FILE_MAX_BYTES,
  FILE_TYPES,
  IMAGE_TYPES,
} from "@/lib/attachments";
import { getViewer } from "@/server/dal";
import { saveAttachment } from "@/server/storage";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** 파일 앞부분으로 진짜 사진인지 확인한다 (확장자만 바꾼 SVG·HTML 등을 막는다) */
function isRealImage(bytes: Uint8Array, ext: string) {
  const at = (i: number, ...sig: number[]) => sig.every((b, j) => bytes[i + j] === b);
  if (ext === "png") return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (ext === "jpg" || ext === "jpeg") return at(0, 0xff, 0xd8, 0xff);
  if (ext === "gif") return at(0, 0x47, 0x49, 0x46, 0x38);
  if (ext === "webp") return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
  return false;
}

export async function POST(request: Request) {
  // 다른 사이트에서 몰래 보낸 요청 막기 (CSRF)
  // Server Action과 같은 기준: 프록시 뒤라면 x-forwarded-host, 아니면 host와 비교한다
  const expected = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
  let originHost: string | null = null;
  try {
    const origin = request.headers.get("origin");
    originHost = origin && origin !== "null" ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || !expected || originHost !== expected) return fail(403, "잘못된 요청이에요");

  const viewer = await getViewer();
  if (!viewer?.profile) return fail(401, ATTACH_MESSAGES.login);

  // 본문 전체를 읽기 전에 크기부터 본다 (파일 30MB + 폼 여유분).
  // 크기를 밝히지 않고 나눠 보내는 요청(chunked)은 끝없이 메모리에 쌓일 수 있어 받지 않는다
  const raw = request.headers.get("content-length");
  const length = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(length)) return fail(411, ATTACH_MESSAGES.failed);
  if (length > FILE_MAX_BYTES + 1024 * 1024) return fail(413, ATTACH_MESSAGES.fileSize);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return fail(400, ATTACH_MESSAGES.failed);
  }
  if (!(file instanceof File)) return fail(400, ATTACH_MESSAGES.failed);

  const name = cleanFileName(file.name);
  const problem = name ? attachmentProblem(name, file.size) : ATTACH_MESSAGES.type;
  if (problem) return fail(problem === ATTACH_MESSAGES.type ? 415 : problem === ATTACH_MESSAGES.empty ? 400 : 413, problem);

  const kind = attachmentKind(name)!;
  const ext = extensionOf(name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === "image" && !isRealImage(bytes, ext)) return fail(415, ATTACH_MESSAGES.notImage);

  const key = randomBytes(16).toString("hex");
  const mime = kind === "image" ? IMAGE_TYPES[ext] : FILE_TYPES[ext];
  try {
    await saveAttachment(key, bytes);
    await db.insert(attachments).values({ key, userId: viewer.userId, kind, name, mime, size: bytes.length });
  } catch (err) {
    console.error("첨부 저장 실패", err);
    return fail(500, ATTACH_MESSAGES.failed);
  }
  return Response.json({ key, url: attachmentUrl(key), kind, name, size: bytes.length });
}
