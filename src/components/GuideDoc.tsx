"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

/** Renders the user-guide markdown. GFM (tables/etc) + heading ids so the
 *  guide's table-of-contents anchor links jump to the right section. */
export function GuideDoc({ markdown }: { markdown: string }) {
  return (
    <div className="guide-doc">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
