import { FeedView } from "@/components/blog/feed-view";
import { parsePage } from "@/components/pagination";
import { getAllTags, listFeed } from "@/server/blog";

export async function generateMetadata(props: PageProps<"/tags/[name]">) {
  const { name } = await props.params;
  return { title: `#${decodeURIComponent(name)}` };
}

export default async function TagPage(props: PageProps<"/tags/[name]">) {
  const tag = decodeURIComponent((await props.params).name);
  const page = parsePage((await props.searchParams).page);
  const [list, tags] = await Promise.all([listFeed({ page, tag }), getAllTags()]);
  return (
    <FeedView
      title={<>🏷 #{tag}</>}
      list={list}
      tags={tags}
      showFollowingTab={false}
      hrefFor={(n) => `/tags/${encodeURIComponent(tag)}?page=${n}`}
      empty={<>이 태그가 달린 글이 없어요.</>}
    />
  );
}
