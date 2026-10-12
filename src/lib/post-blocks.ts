// 코드에 적어 두고 시드가 관리자 글로 넣는 글(첫 공지, 릴리스 노트)의 본문 조각.
// 에디터가 만드는 형식(목록 칸 안에 문단)과 같은 HTML, htmlToText와 같은 요약 글자를 만든다 (test-sanitize가 확인한다).
// 글자에는 <strong>만 쓰고 &·<·> 같은 특수 문자는 쓰지 않는다

export type PostBlock = { h: string } | { p: string } | { ul: string[] };

export function blocksToHtml(blocks: PostBlock[]): string {
  return blocks
    .map((b) => ("h" in b ? `<h2>${b.h}</h2>` : "p" in b ? `<p>${b.p}</p>` : `<ul>${b.ul.map((li) => `<li><p>${li}</p></li>`).join("")}</ul>`))
    .join("");
}

/** 블록 끝마다 줄바꿈, 목록 칸은 칸 + 문단이라 두 번 (htmlToText와 같은 결과) */
export function blocksToText(blocks: PostBlock[]): string {
  return blocks
    .map((b) => ("h" in b ? `${b.h}\n` : "p" in b ? `${b.p}\n` : b.ul.map((li) => `${li}\n\n`).join("")))
    .join("")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
