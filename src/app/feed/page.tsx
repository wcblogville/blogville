import { FeedView } from "@/components/blog/feed-view";
import { parsePage } from "@/components/pagination";
import { getAllTags, listFeed } from "@/server/blog";
import { getViewer } from "@/server/dal";

export const metadata = { title: "마을 소식" };

export default async function FeedPage(props: PageProps<"/feed">) {
  const page = parsePage((await props.searchParams).page);
  const [viewer, list, tags] = await Promise.all([getViewer(), listFeed({ page }), getAllTags()]);
  return (
    <FeedView
      title="📋 마을 소식"
      tab="all"
      list={list}
      tags={tags}
      showFollowingTab={Boolean(viewer?.profile)}
      hrefFor={(n) => `/feed?page=${n}`}
      empty={<>아직 마을에 글이 없어요. 첫 글의 주인공이 되어 보세요! ✏️</>}
    />
  );
}
