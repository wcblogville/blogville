import { getViewer } from "@/server/dal";
import { getHeaderNotifications } from "@/server/notifications";
import { MobileTabBar } from "./mobile-tab-bar";

/** 휴대폰 아래 탭 (회원만). 루트 레이아웃 맨 끝에 둔다. 권한 검사가 아니라 보여 줄지만 정한다 */
export async function MobileTabs() {
  const viewer = await getViewer();
  if (!viewer?.profile) return null;
  const { unread } = await getHeaderNotifications(viewer.userId);
  return <MobileTabBar blogSlug={viewer.profile.blogSlug} unread={unread} />;
}
