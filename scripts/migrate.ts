// scripts/migrate.ts
// Apply pending Drizzle migrations (drizzle/*.sql) to the database.
//
// Uses a Neon **WebSocket Pool** (not the HTTP serverless driver), because
// Drizzle's migrator runs migrations inside a transaction and Neon's HTTP
// driver is stateless and can't do transactions — that's why `drizzle-kit
// migrate` failed against Neon. The WebSocket connection supports transactions.
//
// Connection: prefers DATABASE_URL_UNPOOLED (direct), falls back to DATABASE_URL.
//
// Run:  npm run db:migrate
//
// NOTE: not exercised against a live DB in this worktree (no DATABASE_URL /
// egress here) — verified by types. Run it against Neon to apply migrations.

import { config } from "dotenv";
config({ path: ".env.local" });
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

// Neon's serverless Pool needs a WebSocket implementation in Node.
neonConfig.webSocketConstructor = ws;

async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL(_UNPOOLED) is not set");
  }

  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool);
    console.log("Applying pending migrations from ./drizzle …");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✓ Migrations applied.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
