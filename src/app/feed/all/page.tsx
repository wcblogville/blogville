import { FeedView } from "@/components/blog/feed-view";
import { parsePage } from "@/components/pagination";
import { getAllTags, getPinnedNotice, listAllPosts } from "@/server/blog";
import { getViewer } from "@/server/dal";
import { PixelIcon } from "@/components/pixel-icon";

export const metadata = { title: "모든 글" };

/**
 * 마을 소식 [🌐 모든 글] (사용자 요청 2026-10-12 "모든 글 볼 수 있는 페이지도 하나 있어야겠다"):
 * 모든 회원의 공개 글을 최신순으로 (내 글 포함, 👥 이웃 공개·🔒 비공개·공지 블로그 글은 없다). 방문자도 본다.
 * 광장 게시판(/feed?board=1)에서 탭으로 온다
 */
export default async function AllPostsPage(props: PageProps<"/feed/all">) {
  const viewer = await getViewer();
  const page = parsePage((await props.searchParams).page);
  const [list, tags, notice] = await Promise.all([listAllPosts(page), getAllTags(), getPinnedNotice()]);
  return (
    <FeedView
      title={
        <>
          <PixelIcon name="board" scale={2} />마을 소식
        </>
      }
      tab="everyone"
      list={list}
      tags={tags}
      showFollowingTab={Boolean(viewer?.profile)}
      hrefFor={(n) => `/feed/all?page=${n}`}
      notice={notice}
      empty={<>아직 공개 글이 없어요. 첫 글을 써 보세요!</>}
    />
  );
}
