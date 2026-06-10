"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type SeriesCount = { series: string; label: string; count: number };

const SORTS: { value: string; label: string }[] = [
  { value: "number", label: "FM number" },
  { value: "title", label: "Title" },
  { value: "words", label: "Length" },
];

export default function SeriesFilter({
  counts,
  total,
}: {
  counts: SeriesCount[];
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const activeSeries = params.get("series");
  const activeSort = params.get("sort") ?? "number";
  const hasQuery = !!params.get("q");

  function navigate(key: string, value: string | null) {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    const qs = p.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="mb-8 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={!activeSeries} onClick={() => navigate("series", null)}>
          All <span className="opacity-60">{total}</span>
        </Chip>
        {counts.map((c) => (
          <Chip
            key={c.series}
            active={activeSeries === c.series}
            onClick={() => navigate("series", c.series)}
            title={`FM ${c.series}-* · ${c.label}`}
          >
            {c.label} <span className="opacity-60">{c.count}</span>
          </Chip>
        ))}
      </div>

      {/* Sorting only applies to the browse view; search results are ranked. */}
      {!hasQuery && (
        <label className="flex items-center gap-2 text-xs text-gray-500">
          Sort by
          <select
            value={activeSort}
            onChange={(e) => navigate("sort", e.target.value === "number" ? null : e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-black bg-black text-white"
          : "border-gray-300 text-gray-600 hover:border-black hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}
