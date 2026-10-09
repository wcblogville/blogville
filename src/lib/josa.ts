// 한국어 조사: 앞 낱말의 마지막 소리에 받침이 있으면 을·이·은·과, 없으면 를·가·는·와.
// "Lv.2이", "먹이을(를)"처럼 어색한 문구를 없앤다. DB를 쓰지 않는 순수 함수

type Pair = "을/를" | "이/가" | "은/는" | "과/와";

/** 마지막 소리에 받침이 있는지. 한글·숫자가 아니면(영어·이모지) 알 수 없어 null */
export function hasBatchim(word: string): boolean | null {
  // "모자(빨강)", "「제목」"처럼 끝에 붙은 괄호·기호는 읽지 않는다
  const last = word.replace(/[\s)\]}」』"'.,!?~]+$/u, "").at(-1);
  if (!last) return null;
  // 숫자는 한국어로 읽은 소리: 이(2)·사(4)·오(5)·구(9)만 받침이 없다. 0은 영·십·백·천·만이라 받침이 있다
  if (/[0-9]/.test(last)) return !"2459".includes(last);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 0xd7a3 - 0xac00) return null;
  return code % 28 !== 0;
}

/** 낱말 + 알맞은 조사. 알 수 없으면 "을(를)"처럼 둘 다 적는다 */
export function withJosa(word: string, pair: Pair): string {
  const [withBatchim, without] = pair.split("/");
  const batchim = hasBatchim(word);
  if (batchim === null) return `${word}${withBatchim}(${without})`;
  return `${word}${batchim ? withBatchim : without}`;
}
