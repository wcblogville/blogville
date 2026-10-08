// 글 첨부 내려주기 (POST-07, POST-09). 사진은 화면에 바로, 파일은 올린 사람이 붙인 원래 이름으로 내려받는다.
// 누가 열 수 있나 (POST-02 첨부 공개 범위 / FR-029, contracts/attachments-http.md §2): 공개 글 첨부·프로필 사진은 누구나,
// 비공개 글 첨부는 그 블로그 주인만, 어느 글에도 안 붙은 첨부는 올린 사람만. 안 되면 없는 것과 똑같이 404
import { ATTACHMENT_KEY_RE, attachmentAccess } from "@/lib/attachments";
import { findReadableAttachment } from "@/server/attachments";
import { getViewer } from "@/server/dal";
import { attachmentExists, openAttachment } from "@/server/storage";

const notFound = () => new Response("파일을 찾을 수 없어요", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: Request, ctx: RouteContext<"/files/[key]">) {
  const { key } = await ctx.params;
  if (!ATTACHMENT_KEY_RE.test(key)) return notFound();
  const row = await findReadableAttachment(key);
  if (!row) return notFound();

  // 누구나 볼 수 있는 첨부는 세션을 읽지 않는다 (글 상세의 사진마다 세션 조회가 늘지 않게)
  const open = row.postVisibility === "public" || (row.postVisibility === null && row.isProfilePhoto);
  const viewer = open ? null : await getViewer();
  const allowed = attachmentAccess({
    postVisibility: row.postVisibility,
    postOwnerId: row.postOwnerId,
    uploaderId: row.uploaderId,
    isProfilePhoto: row.isProfilePhoto,
    viewerId: viewer?.userId ?? null,
  });
  if (!allowed) return notFound();

  const etag = `"${key}"`;
  // 키가 같으면 내용도 같다. 권한은 매번 확인하므로 캐시는 private + 다시 묻기(no-cache)
  const cache = { "Cache-Control": "private, no-cache", ETag: etag };
  if (request.headers.get("if-none-match") === etag) {
    if (!(await attachmentExists(key))) return notFound();
    return new Response(null, { status: 304, headers: cache });
  }

  const body = await openAttachment(key);
  if (!body) return notFound();

  // 한글 이름은 filename*(UTF-8)로, 옛 브라우저용 filename에는 ASCII 밖 글자와 " \ 를 _로 바꿔 넣는다
  const encoded = encodeURIComponent(row.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const ascii = row.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const disposition = `${row.kind === "image" ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;

  return new Response(body, {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.size),
      "Content-Disposition": disposition,
      // 브라우저가 형식을 추측해 HTML처럼 실행하지 못하게 한다
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
      ...cache,
    },
  });
}
