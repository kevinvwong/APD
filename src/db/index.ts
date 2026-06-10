import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Lazily initialize the connection so that importing this module does NOT
// require DATABASE_URL to be set. `neon()` is only called on first actual query
// (request time), which keeps `next build` working without a database — pages
// are force-dynamic, so no queries run while collecting page data.
let instance: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set.");
    instance = drizzle(neon(url), { schema });
  }
  return instance;
}

// Proxy keeps every existing `db.select()…` call site unchanged while deferring
// the connection until the first property access.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
