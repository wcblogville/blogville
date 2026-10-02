import { FeedView } from "@/components/blog/feed-view";
import { parsePage } from "@/components/pagination";
import { getAllTags, listFeed } from "@/server/blog";

export async function generateMetadata(props: PageProps<"/tags/[name]">) {
  // generateMetadata의 params는 이미 디코딩되어 온다 (/tags/100%25 → "100%").
  // 페이지 본문과 달리 다시 디코딩하면 %가 든 태그에서 URIError가 난다 (POST-04, #20)
  const { name } = await props.params;
  return { title: `#${name}` };
}

export default async function TagPage(props: PageProps<"/tags/[name]">) {
  // 페이지의 params는 인코딩된 그대로 온다 (/tags/100%25 → "100%25")
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
