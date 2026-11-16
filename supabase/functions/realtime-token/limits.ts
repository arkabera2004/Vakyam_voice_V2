// Pure helpers for the realtime-token function. No Deno imports, so vitest
// can run limits.test.ts from the repo root.

/** Sessions one user may start per rolling hour before the function answers 429. */
export const DEFAULT_SESSIONS_PER_HOUR = 10;

export type TokenRequest = { speechOnly: boolean };

/** Reads the optional JSON body; anything unparseable means a full realtime session. */
export function parseTokenRequest(body: string | null | undefined): TokenRequest {
  if (!body) return { speechOnly: false };
  try {
    const parsed = JSON.parse(body) as { speechOnly?: unknown };
    return { speechOnly: parsed?.speechOnly === true };
  } catch {
    return { speechOnly: false };
  }
}

/** True when the caller already used up the hourly budget. */
export function overLimit(sessionsInLastHour: number, limit = DEFAULT_SESSIONS_PER_HOUR): boolean {
  return sessionsInLastHour >= limit;
}

/** PostgREST answers `Content-Range: 0-9/23` (or star-slash-0 when empty); the part after the slash is the count. */
export function countFromContentRange(header: string | null): number {
  const total = header?.split("/")[1];
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

/** Reads the hourly limit from the environment, falling back to the default on junk. */
export function limitFromEnv(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_SESSIONS_PER_HOUR;
}
