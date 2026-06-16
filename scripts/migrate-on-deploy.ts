// scripts/migrate-on-deploy.ts
//
// Optional deploy-time migration hook. Runs the transaction-capable migrator
// (scripts/migrate.ts, over a Neon WebSocket Pool) ONLY on Vercel production
// builds, so schema and code can ship together. Skipped on previews, CI, and
// local builds, where migrating the shared database on every build is wrong.
//
// NON-FATAL by design: a migration hiccup logs loudly but never aborts the
// build, so a transient DB issue can't freeze all deploys (which is exactly
// what happened when the build aborted on `drizzle-kit migrate` failing).
//
// NOT wired into `npm run build` by default. To enable deploy-time migration
// once you've confirmed `npm run db:migrate` works against your database, set
// the build script to: "tsx scripts/migrate-on-deploy.ts && next build".
//
// Overrides:
//   MIGRATE_ON_DEPLOY=1   force the migration to run (e.g. local/one-off)
//   SKIP_MIGRATE=1        force skip

import { spawnSync } from "node:child_process";

const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined
const force = process.env.MIGRATE_ON_DEPLOY === "1";
const skip = process.env.SKIP_MIGRATE === "1";

if (skip || (!force && vercelEnv !== "production")) {
  console.log(
    `[migrate-on-deploy] skipping migrations (VERCEL_ENV=${vercelEnv ?? "unset"}). ` +
      `Set MIGRATE_ON_DEPLOY=1 to force.`,
  );
  process.exit(0);
}

if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
  console.warn(
    "[migrate-on-deploy] no DATABASE_URL(_UNPOOLED) set — skipping migrations.",
  );
  process.exit(0);
}

console.log("[migrate-on-deploy] running migrations (scripts/migrate.ts)…");
const res = spawnSync("npx", ["tsx", "scripts/migrate.ts"], {
  stdio: "inherit",
});
if (res.status !== 0) {
  // Never block a deploy on a migration failure — surface it loudly instead.
  console.error(
    "[migrate-on-deploy] ⚠ migrations did not complete; continuing the build. " +
      "Run `npm run db:migrate` manually to apply them.",
  );
}
process.exit(0);
