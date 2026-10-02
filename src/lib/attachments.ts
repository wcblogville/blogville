// 글 첨부(사진·파일) 규칙: 브라우저와 서버가 같은 값을 쓴다 (POST-07 사진, POST-09 파일)

export type AttachmentKind = "image" | "file";

/** 사진: 확장자 → 저장·응답할 형식 */
export const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** 파일: 확장자 → 형식. HTML·SVG·JS·EXE처럼 열거나 실행될 수 있는 형식은 받지 않는다 */
export const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  hwp: "application/x-hwp",
  hwpx: "application/hwp+zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  key: "application/vnd.apple.keynote",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  json: "application/json",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
};

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const FILE_MAX_BYTES = 30 * 1024 * 1024;
/** 원래 파일 이름 최대 길이 (내려받을 때 이 이름을 쓴다) */
export const FILE_NAME_MAX = 255;

/** 저장 이름(주소에 들어가는 키): 서버가 만드는 무작위 32자. 올린 파일 이름은 주소에 쓰지 않는다 */
export const ATTACHMENT_KEY_RE = /^[a-f0-9]{32}$/;
export const attachmentUrl = (key: string) => `/files/${key}`;
export const ATTACHMENT_URL_RE = /^\/files\/([a-f0-9]{32})$/;

export const ATTACH_MESSAGES = {
  type: "올릴 수 없는 형식이에요. 사진은 PNG·JPG·GIF·WEBP, 파일은 PDF·한글·워드·엑셀·파워포인트·키노트·ZIP·TXT·CSV·MD·JSON·MP3·MP4만 올릴 수 있어요",
  imageSize: "사진은 10MB까지 올릴 수 있어요",
  fileSize: "파일은 30MB까지 올릴 수 있어요",
  empty: "빈 파일은 올릴 수 없어요",
  notImage: "사진 파일이 아니에요. PNG·JPG·GIF·WEBP 사진만 올릴 수 있어요",
  login: "로그인한 회원만 올릴 수 있어요",
  failed: "올리지 못했어요. 다시 시도해 주세요",
} as const;

/** 확장자 (소문자, 점 없이). 없으면 "" */
export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** 이름으로 사진/파일을 나눈다. 받지 않는 형식이면 null */
export function attachmentKind(name: string): AttachmentKind | null {
  const ext = extensionOf(name);
  if (ext in IMAGE_TYPES) return "image";
  if (ext in FILE_TYPES) return "file";
  return null;
}

/** 형식·크기를 확인해 문제가 있으면 보여줄 문구, 없으면 null (브라우저가 먼저, 서버가 다시 확인) */
export function attachmentProblem(name: string, size: number): string | null {
  const kind = attachmentKind(name);
  if (!kind) return ATTACH_MESSAGES.type;
  if (size <= 0) return ATTACH_MESSAGES.empty;
  if (kind === "image" && size > IMAGE_MAX_BYTES) return ATTACH_MESSAGES.imageSize;
  if (kind === "file" && size > FILE_MAX_BYTES) return ATTACH_MESSAGES.fileSize;
  return null;
}

/** 1234567 → "1.2MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, "")}MB`;
}

/** 파일 카드의 화면 읽기용 이름 */
export const fileCardLabel = (name: string, size: number) => `${name} 내려받기 (${formatBytes(size)})`;

/** 파일 이름에서 경로·제어 문자를 빼고 길이를 줄인다 */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (cleaned.length <= FILE_NAME_MAX) return cleaned;
  const ext = extensionOf(cleaned);
  return `${cleaned.slice(0, FILE_NAME_MAX - ext.length - 1)}.${ext}`;
}
