"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/lib/toc";

const INDENT: Record<number, string> = { 1: "pl-0", 2: "pl-3", 3: "pl-6" };

export default function Toc({ entries }: { entries: TocEntry[] }) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Reading-progress bar driven by window scroll position.
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Scroll-spy: highlight the heading nearest the top of the viewport.
  useEffect(() => {
    if (entries.length === 0) return;
    const headings = entries
      .map((e) => document.getElementById(e.slug))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSlug(visible[0].target.id);
      },
      { rootMargin: "0px 0px -80% 0px", threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <>
      <div className="fixed top-0 left-0 z-50 h-1 bg-black transition-[width] duration-150"
           style={{ width: `${progress}%` }} aria-hidden />
      <aside className="hidden lg:block">
        <nav className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-auto text-sm">
          <p className="font-semibold text-xs uppercase tracking-wide text-gray-400 mb-2">
            Contents
          </p>
          <ul className="space-y-1 border-l border-gray-200">
            {entries.map((e, i) => {
              const active = e.slug === activeSlug;
              return (
                <li key={`${e.slug}-${i}`} className={INDENT[e.depth] ?? "pl-0"}>
                  <a
                    href={`#${e.slug}`}
                    className={`-ml-px block border-l-2 pl-3 py-0.5 leading-snug transition-colors ${
                      active
                        ? "border-black font-medium text-black"
                        : "border-transparent text-gray-500 hover:text-black"
                    }`}
                  >
                    {e.text}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
