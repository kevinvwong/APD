"use client";

export const SERIES_MAP: Record<number, string> = {
  1: "Personnel & References",
  2: "Intelligence",
  3: "Operations, Fires & Maneuver",
  4: "Sustainment",
  5: "Planning",
  6: "Mission Command & Signal",
  7: "Training & Readiness",
};

export type Scope = 0 | "bm" | "rc" | number;

interface SeriesRailProps {
  scope: Scope;
  totalCount: number;
  bookmarkCount: number;
  recentCount: number;
  seriesCounts: Record<number, number>;
  railOpen: boolean;
  onSetScope: (s: Scope) => void;
}

export function SeriesRail({
  scope,
  totalCount,
  bookmarkCount,
  recentCount,
  seriesCounts,
  railOpen,
  onSetScope,
}: SeriesRailProps) {
  return (
    <div className={"rail scroll" + (railOpen ? " open" : "")}>
      <div className="rail-h">Library</div>

      <div
        className={"rail-item" + (scope === 0 ? " on" : "")}
        onClick={() => onSetScope(0)}
      >
        <span className="rail-num">·</span>
        <span className="rail-name">All Series</span>
        <span className="rail-count">{totalCount}</span>
      </div>

      <div
        className={"rail-item" + (scope === "bm" ? " on" : "")}
        onClick={() => onSetScope("bm")}
      >
        <span className="rail-num" style={{ color: "var(--gold)" }}>
          ★
        </span>
        <span className="rail-name">Bookmarked</span>
        <span className="rail-count">{bookmarkCount}</span>
      </div>

      <div
        className={"rail-item" + (scope === "rc" ? " on" : "")}
        onClick={() => onSetScope("rc")}
      >
        <span className="rail-num" style={{ fontSize: 14 }}>
          ◷
        </span>
        <span className="rail-name">Recently Read</span>
        <span className="rail-count">{recentCount}</span>
      </div>

      <div className="rail-h" style={{ paddingTop: 18 }}>
        Doctrinal Series
      </div>

      {Object.entries(SERIES_MAP).map(([k, name]) => {
        const num = Number(k);
        return (
          <div
            key={k}
            className={"rail-item" + (scope === num ? " on" : "")}
            onClick={() => onSetScope(num)}
          >
            <span className="rail-num">{k}</span>
            <span className="rail-name">{name}</span>
            <span className="rail-count">{seriesCounts[num] ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}
