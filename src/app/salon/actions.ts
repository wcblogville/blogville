"use server";

import { styleAction } from "@/server/style";

/** 미용실 [적용하기] (SHOP-07): 머리 모양·머리 색. 없는 것은 pay(화면이 보여 준 코인)만큼 내고 사서 입는다 */
export async function saveSalonStyle(selection: unknown, pay: unknown) {
  return styleAction("salon", selection, pay);
}
