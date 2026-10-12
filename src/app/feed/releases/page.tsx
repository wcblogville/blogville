import { FeedView } from "@/components/blog/feed-view";
import { parsePage } from "@/components/pagination";
import { getAllTags, getPinnedNotice, listReleaseNotes } from "@/server/blog";
import { getViewer } from "@/server/dal";

export const metadata = { title: "릴리스 노트" };

/**
 * 마을 소식 [📜 릴리스 노트] (사용자 요청 2026-10-12): 공지 블로그의 "릴리스 노트" 분류 글을 최신순으로.
 * 글은 src/content/release-notes.ts에 버전마다 적어 두면 배포 때 시드가 넣는다. 방문자도 본다
 */
export default async function ReleaseNotesPage(props: PageProps<"/feed/releases">) {
  const viewer = await getViewer();
  const page = parsePage((await props.searchParams).page);
  const [list, tags, notice] = await Promise.all([listReleaseNotes(page), getAllTags(), getPinnedNotice()]);
  return (
    <FeedView
      title="📋 마을 소식"
      tab="releases"
      list={list}
      tags={tags}
      showFollowingTab={Boolean(viewer?.profile)}
      hrefFor={(n) => `/feed/releases?page=${n}`}
      notice={notice}
      empty={<>아직 릴리스 노트가 없어요.</>}
    />
  );
}
