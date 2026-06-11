// scripts/upload-figures.ts — Upload rendered FM figure pages to Vercel Blob.
// Reads .tmp/figures/*.png and the manifest, uploads each PNG to Blob under
// path "figures/<filename>", then writes an updated manifest with the public
// URL for each entry to src/data/figures-manifest.json.
//
// Run: npx tsx scripts/upload-figures.ts

import { config } from "dotenv";
config({ path: ".env.blob" }); // BLOB_READ_WRITE_TOKEN lives here
import { put, list } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";

interface RawEntry {
  fm_number: string;
  label: string;
  page: number;
  file: string;
  kind: "figure" | "table";
}

interface ManifestEntry extends RawEntry {
  url: string;
}

const FIGURES_DIR = path.join(process.cwd(), ".tmp", "figures");
const MANIFEST_IN = path.join(FIGURES_DIR, "manifest.json");
const MANIFEST_OUT = path.join(
  process.cwd(),
  "src",
  "data",
  "figures-manifest.json",
);

async function main() {
  // Use either BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN + BLOB_STORE_ID.
  // vercel env pull masks sensitive vars, so the read-write token is usually
  // empty locally — fall back to OIDC, which the CLI does populate.
  const hasRwToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const hasOidc =
    !!process.env.VERCEL_OIDC_TOKEN && !!process.env.BLOB_STORE_ID;
  if (!hasRwToken && !hasOidc) {
    console.error(
      "Need BLOB_READ_WRITE_TOKEN or (VERCEL_OIDC_TOKEN + BLOB_STORE_ID). " +
        "Run: vercel env pull .env.blob --environment=production",
    );
    process.exit(1);
  }
  // When RW token is present, force the SDK to use it by clearing OIDC env
  // and passing the token explicitly. Otherwise the SDK auto-detects OIDC
  // first and hits BlobOidcEnvironmentNotAllowedError on development env.
  if (hasRwToken) {
    delete process.env.VERCEL_OIDC_TOKEN;
  }
  const authOpts = hasRwToken
    ? { token: process.env.BLOB_READ_WRITE_TOKEN! }
    : {
        oidcToken: process.env.VERCEL_OIDC_TOKEN!,
        storeId: process.env.BLOB_STORE_ID!,
      };

  const raw: RawEntry[] = JSON.parse(fs.readFileSync(MANIFEST_IN, "utf-8"));
  console.log(`Loaded ${raw.length} caption entries`);

  // Get list of files we need to upload (unique by filename)
  const uniqueFiles = Array.from(new Set(raw.map((e) => e.file)));
  console.log(`${uniqueFiles.length} unique PNGs to consider`);

  // Check what's already uploaded so we can resume
  console.log("Listing existing Blob entries…");
  const existing = new Map<string, string>(); // pathname -> url
  let cursor: string | undefined;
  do {
    const result = await list({
      cursor,
      limit: 1000,
      prefix: "figures/",
      ...authOpts,
    });
    for (const b of result.blobs) {
      existing.set(b.pathname, b.url);
    }
    cursor = result.cursor;
  } while (cursor);
  console.log(`${existing.size} already uploaded`);

  // Upload missing files
  const urlByFile = new Map<string, string>();
  for (const [pathname, url] of existing) {
    const filename = pathname.replace(/^figures\//, "");
    urlByFile.set(filename, url);
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const total = uniqueFiles.length;

  for (let i = 0; i < uniqueFiles.length; i++) {
    const file = uniqueFiles[i];
    if (urlByFile.has(file)) {
      skipped++;
      continue;
    }
    const localPath = path.join(FIGURES_DIR, file);
    if (!fs.existsSync(localPath)) {
      console.warn(`  MISSING local file: ${file}`);
      failed++;
      continue;
    }
    try {
      const body = fs.readFileSync(localPath);
      const blob = await put(`figures/${file}`, body, {
        access: "public",
        contentType: "image/png",
        cacheControlMaxAge: 60 * 60 * 24 * 365, // 1 year
        addRandomSuffix: false,
        allowOverwrite: false,
        ...authOpts,
      });
      urlByFile.set(file, blob.url);
      uploaded++;
      if (uploaded % 50 === 0 || i === uniqueFiles.length - 1) {
        console.log(
          `  [${i + 1}/${total}] uploaded ${uploaded}, skipped ${skipped}, failed ${failed}`,
        );
      }
    } catch (e: any) {
      console.error(`  FAILED ${file}: ${e.message}`);
      failed++;
    }
  }

  // Build the output manifest with public URLs
  const out: ManifestEntry[] = raw
    .map((e) => {
      const url = urlByFile.get(e.file);
      return url ? { ...e, url } : null;
    })
    .filter((e): e is ManifestEntry => e !== null);

  fs.mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(out));
  const size = (fs.statSync(MANIFEST_OUT).size / 1024).toFixed(1);

  console.log(
    `\nDone. Uploaded ${uploaded}, skipped ${skipped}, failed ${failed}`,
  );
  console.log(
    `Manifest: ${out.length} entries -> ${MANIFEST_OUT} (${size} KB)`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
