"use client";

import { useEffect } from "react";
import { recordBlogVisit } from "@/app/blog/actions";

/** 글 상세를 연 사람도 그 블로그 방문자로 센다 (BLOG-06). 화면에는 아무것도 그리지 않는다 */
export function RecordVisit({ blogId }: { blogId: number }) {
  useEffect(() => {
    recordBlogVisit(blogId).catch(() => {});
  }, [blogId]);
  return null;
}
