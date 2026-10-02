import Link from "next/link";
import { FeedView } from "@/components/blog/feed-view";
import { parsePage } from "@/components/pagination";
import { getAllTags, listFeed } from "@/server/blog";
import { requireMember } from "@/server/dal";

export const metadata = { title: "이웃 새 글" };

export default async function FollowingFeedPage(props: PageProps<"/feed/following">) {
  const viewer = await requireMember();
  const page = parsePage((await props.searchParams).page);
  const [list, tags] = await Promise.all([listFeed({ page, followerId: viewer.userId }), getAllTags()]);
  return (
    <FeedView
      title="💛 이웃 새 글"
      tab="following"
      list={list}
      tags={tags}
      showFollowingTab
      hrefFor={(n) => `/feed/following?page=${n}`}
      empty={
        <>
          아직 이웃이 없거나 이웃의 새 글이 없어요.
          <br />
          <Link href="/feed" className="font-bold text-leaf-dark underline">마을 소식</Link>에서 마음에 드는 블로그를 이웃으로 추가해 보세요.
        </>
      }
    />
  );
}
