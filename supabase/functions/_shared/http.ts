// Response helpers shared by the Edge Functions. No Deno globals, so vitest
// can import this file; the caller passes the allowed origin in.

export function corsHeaders(allowedOrigin: string | undefined): Record<string, string> {
  return {
    // Set ALLOWED_ORIGIN to the app's origin in production; "*" is for local dev.
    "Access-Control-Allow-Origin": allowedOrigin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

/** Error carrying the HTTP status the client should see; the message is safe to show. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Reads a JSON body; an empty or malformed body is reported as 400, not 500. */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "The request body is not valid JSON");
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only for a well-formed UUID. A PostgREST URL's query string is a
 * filter expression (?id=eq.<value>&...): interpolating an unvalidated
 * caller-supplied ID into one lets a value containing "&" or "," inject
 * extra filter operators. RLS still bounds what rows are reachable, but
 * every ID taken from a request body must pass this before being used in
 * a REST URL, rather than relying on RLS alone to contain a malformed
 * filter.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
