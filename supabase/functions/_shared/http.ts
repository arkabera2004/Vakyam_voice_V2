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
