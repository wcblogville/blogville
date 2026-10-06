// 글 첨부 내려주기 (POST-07, POST-09). 사진은 화면에 바로, 파일은 올린 사람이 붙인 원래 이름으로 내려받는다
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { ATTACHMENT_KEY_RE } from "@/lib/attachments";
import { openAttachment } from "@/server/storage";

const notFound = () => new Response("파일을 찾을 수 없어요", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(_request: Request, ctx: RouteContext<"/files/[key]">) {
  const { key } = await ctx.params;
  if (!ATTACHMENT_KEY_RE.test(key)) return notFound();
  const [row] = await db.select().from(attachments).where(eq(attachments.key, key));
  if (!row) return notFound();
  const body = await openAttachment(key);
  if (!body) return notFound();

  // 한글 이름은 filename*(UTF-8)로, 옛 브라우저용 filename에는 영문·숫자만 남긴다
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
      // 키가 바뀌지 않는 한 내용도 바뀌지 않는다
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
