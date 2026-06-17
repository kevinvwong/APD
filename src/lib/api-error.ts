// src/lib/api-error.ts
import { NextResponse } from "next/server";

/**
 * Wrap a route handler so a thrown error (e.g. a DB/FK violation) becomes a
 * clean JSON 500 instead of an unhandled crash. Preserves the handler's
 * argument types.
 */
export function withApiError<A extends unknown[]>(
  label: string,
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error(`[${label}]`, e);
      return NextResponse.json({ error: "Server error." }, { status: 500 });
    }
  };
}
