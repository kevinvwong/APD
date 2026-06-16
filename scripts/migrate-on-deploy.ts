// scripts/migrate-on-deploy.ts
//
// ⚠️ NOT wired into the build. `drizzle-kit migrate` wraps migrations in a
// transaction, which Neon's HTTP serverless driver can't run during the Vercel
// build — so this aborted every production deploy. The runtime JSON fallback
// (src/app/api/ask/route.ts) is the anti-drift safety net instead. Kept here
// for manual/opt-in use (`MIGRATE_ON_DEPLOY=1 tsx scripts/migrate-on-deploy.ts`);
// to re-wire it into deploys, give drizzle a transaction-capable connection
// (a Neon WebSocket Pool or a plain pg/postgres client for migrations).
//
// Apply pending DB migrations as part of the build — but ONLY on Vercel
// production builds, so schema and code ship together and can't drift. (Schema
// drift is what caused the `relation "sources" does not exist` outage: the
// `sources` code deployed while the rename migration was never applied.)
//
// Skipped on previews, CI, and local builds, where running migrations against
// the shared database on every build would be wrong. Wired into `npm run build`
// ahead of `next build`.
//
// Overrides:
//   MIGRATE_ON_DEPLOY=1   force migrations to run (e.g. a one-off)
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
  console.error(
    "[migrate-on-deploy] no DATABASE_URL(_UNPOOLED) set — cannot migrate.",
  );
  process.exit(1);
}

console.log(
  "[migrate-on-deploy] applying pending migrations (drizzle-kit migrate)…",
);
const res = spawnSync("npx", ["drizzle-kit", "migrate"], { stdio: "inherit" });
if (res.status !== 0) {
  console.error("[migrate-on-deploy] migration failed — aborting build.");
  process.exit(res.status ?? 1);
}
console.log("[migrate-on-deploy] migrations applied.");
