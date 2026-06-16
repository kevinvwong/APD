// scripts/check-index-fresh.ts
// CI guard: validate that src/data/search-index.json is present, parseable, and
// well-formed (a non-empty array of sections carrying the required fields).
// Catches a missing / empty / corrupt index before it ships. No DB or network.
//
// Run:  npm run check:index

import fs from "fs";
import path from "path";

const REQUIRED = ["f", "n", "ft", "a", "h", "b"] as const;

export interface IndexIssue {
  level: "error" | "warn";
  msg: string;
}

/** Validate a parsed search index. Returns issues; an empty array means OK. */
export function validateSearchIndex(data: unknown): IndexIssue[] {
  if (!Array.isArray(data))
    return [{ level: "error", msg: "search index is not a JSON array" }];
  if (data.length === 0)
    return [{ level: "error", msg: "search index is empty" }];

  let malformed = 0;
  for (const row of data) {
    if (typeof row !== "object" || row === null) {
      malformed++;
      continue;
    }
    const r = row as Record<string, unknown>;
    if (REQUIRED.some((k) => !(k in r))) malformed++;
  }
  if (malformed)
    return [
      {
        level: "error",
        msg: `${malformed} of ${data.length} sections missing required fields (${REQUIRED.join(", ")})`,
      },
    ];
  return [];
}

function main() {
  const p = path.join(process.cwd(), "src", "data", "search-index.json");
  if (!fs.existsSync(p)) {
    console.error(
      "✗ src/data/search-index.json is missing — run `npm run search:index`.",
    );
    process.exit(1);
  }
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    console.error(
      `✗ search-index.json is not valid JSON: ${(e as Error).message}`,
    );
    process.exit(1);
  }
  const issues = validateSearchIndex(data);
  for (const i of issues)
    console.error(`${i.level === "error" ? "✗" : "⚠"} ${i.msg}`);
  if (issues.some((i) => i.level === "error")) process.exit(1);
  console.log(
    `✓ search-index.json OK (${(data as unknown[]).length} sections).`,
  );
}

// Run only when invoked directly (not when imported by the test).
if (process.argv[1] && /check-index-fresh\.ts$/.test(process.argv[1])) main();
