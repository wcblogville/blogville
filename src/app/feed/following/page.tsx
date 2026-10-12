import { FeedView } from "@/components/blog/feed-view";
import { parsePage } from "@/components/pagination";
import { getAllTags, getPinnedNotice, listFeed } from "@/server/blog";
import { requireMember } from "@/server/dal";

export const metadata = { title: "이웃 새 글" };

/** 이웃 새 글: 이웃 추가한 모든 이웃의 글 (즐겨찾기 포함, 모르는 사람·공지 블로그 글은 없다). 맨 위 공지는 마을 전체와 같다 */
export default async function FollowingFeedPage(props: PageProps<"/feed/following">) {
  const viewer = await requireMember();
  const page = parsePage((await props.searchParams).page);
  const [list, tags, notice] = await Promise.all([listFeed({ page, followerId: viewer.userId }), getAllTags(), getPinnedNotice()]);
  return (
    <FeedView
      title="💛 이웃 새 글"
      tab="following"
      list={list}
      tags={tags}
      showFollowingTab
      hrefFor={(n) => `/feed/following?page=${n}`}
      notice={notice}
      empty={
        <>
          아직 이웃이 없거나 이웃의 새 글이 없어요.
          <br />
          🏷 인기 태그나 내 블로그 옆 칸의 🏘 마을 검색에서 마음에 드는 블로그를 찾아 [+ 이웃 추가]를 눌러 보세요.
        </>
      }
    />
  );
}
