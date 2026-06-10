// Shared presentational UI primitives (no hooks — usable in server or client
// components). They centralize class clusters that were otherwise hand-copied
// across the landing page, reader, and ask panel.

import type { InputHTMLAttributes, ReactNode } from "react";
import type { TocEntry } from "@/lib/fm-parse";
import { SearchIcon } from "./icons";

/** Text input with a leading magnifier icon. Forwards all native input props
 *  (works controlled or uncontrolled). `containerClassName` sizes the wrapper. */
export function SearchField({
  containerClassName = "",
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { containerClassName?: string }) {
  return (
    <div className={`relative ${containerClassName}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        className={`w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 ${className}`}
        {...props}
      />
    </div>
  );
}

/** Monospaced "FM 3-0"-style number badge. */
export function FmBadge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700 ${className}`}
    >
      {children}
    </span>
  );
}

/** Table of contents, shared by the desktop sidebar and the mobile <details>.
 *  A single map keeps link rendering in one place; `variant` only swaps styling. */
export function TocList({
  entries,
  variant,
}: {
  entries: TocEntry[];
  variant: "sidebar" | "mobile";
}) {
  const isSidebar = variant === "sidebar";
  return (
    <ol className={isSidebar ? "space-y-1 border-l border-gray-200" : "mt-3 space-y-1"}>
      {entries.map((e) => (
        <li key={e.id} className={!isSidebar && e.level === 2 ? "pl-4" : ""}>
          <a
            href={`#${e.id}`}
            className={
              isSidebar
                ? `-ml-px block border-l-2 py-0.5 text-sm transition ${
                    e.level === 2
                      ? "border-transparent pl-5 text-gray-500 hover:border-brand-300 hover:text-brand-700"
                      : "border-transparent pl-3 font-medium text-gray-700 hover:border-brand-500 hover:text-brand-800"
                  }`
                : "text-sm text-brand-700 hover:underline"
            }
          >
            {e.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
