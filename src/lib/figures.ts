// src/lib/figures.ts
// Server-side loader for the figures manifest produced by
// scripts/upload-figures.ts. The manifest maps (fm_number, label) -> public
// Blob URL of the rendered PDF page image.

import fs from "node:fs";
import path from "node:path";

interface ManifestEntry {
  fm_number: string;
  label: string;
  page: number;
  file: string;
  kind: "figure" | "table";
  url: string;
}

let CACHE: ManifestEntry[] | null = null;

function load(): ManifestEntry[] {
  if (CACHE) return CACHE;
  const p = path.join(process.cwd(), "src", "data", "figures-manifest.json");
  try {
    CACHE = JSON.parse(fs.readFileSync(p, "utf-8")) as ManifestEntry[];
  } catch {
    CACHE = [];
  }
  return CACHE;
}

/**
 * Returns a lookup object { "Figure 1-1": "https://...png" } for a single FM.
 * Used by parseFM() at request time to attach URLs to .fig blocks.
 */
export function getFigureUrls(fmNumber: string): Record<string, string> {
  const all = load();
  const out: Record<string, string> = {};
  for (const e of all) {
    if (e.fm_number === fmNumber) out[e.label] = e.url;
  }
  return out;
}
