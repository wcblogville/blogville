"use server";

import { styleAction } from "@/server/style";

/** 옷가게 [적용하기] (SHOP-08): 옷·모자·소품. 없는 것은 pay(화면이 보여 준 코인)만큼 내고 사서 입는다 */
export async function saveClothesStyle(selection: unknown, pay: unknown) {
  return styleAction("clothes", selection, pay);
}
