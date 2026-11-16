# Vakyam Voice V2 — API and Endpoint Audit

Method: `grep -rnE 'fetch\(|supabase\.|functions\.invoke|\.rpc\(|\.from\(|WebSocket|RTCPeerConnection' src supabase` plus a read of every hit. There is **no `/api` directory and no custom HTTP server**. Every network operation in the product is listed below. Project host is `eshtcyzraxojwkzqgqld.supabase.co`; keys and tokens are omitted.

## 1. Endpoint register

| ID | Method / op | URL or operation | Source | Purpose | Auth | Authorization | Request | Response | DB dep | External dep |
|---|---|---|---|---|---|---|---|---|---|---|
| E01 | POST | `{SUPABASE_URL}/functions/v1/realtime-token` (via `supabase.functions.invoke`) | `src/hooks/useVoiceAgent.ts:34`; `src/console/speak.ts:52` | Mint a short-lived Azure Realtime client secret (+ optional Azure Speech token) bound to Meera's prompt | **Required**: `Authorization: Bearer <user JWT>`; function re-validates with `GET /auth/v1/user` (`index.ts:38-45`) | Any signed-in user; no roles | No body | `200 {token, callUrl, firstMessage, speech?{token,region,voice}}`; `401 {error:"Unauthorized"}`; `500 {error:<message>}` | none | Azure OpenAI, Azure Speech, Supabase Auth |
| E02 | POST | `VITE_REALTIME_TOKEN_URL` (local Deno copy of E01) | `useVoiceAgent.ts:33-41` | Local testing of the function | Bearer user JWT | same | none | same | none | same |
| E03 | POST | `https://{AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/realtime/client_secrets` | `index.ts:54-64` (server-side) | Create realtime session with instructions | `api-key` header (server secret) | — | `{session:{type:"realtime",model,instructions,…}}` | `{value:<token>}` | none | Azure OpenAI |
| E04 | POST | `https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken` | `index.ts:68-71` (server-side) | 10-minute Speech token | `Ocp-Apim-Subscription-Key` (server secret) | — | empty | token text | none | Azure Speech |
| E05 | GET | `{SUPABASE_URL}/auth/v1/user` | `index.ts:41-43` (server-side) | Verify the caller's JWT | Bearer + apikey | — | — | 200 user / 401 | auth schema | Supabase Auth |
| E06 | POST (browser→Azure) | `{callUrl}` = `…/openai/v1/realtime/calls?webrtcfilter=on` | `useVoiceAgent.ts:209-214` | SDP offer → answer for WebRTC | Bearer ephemeral token from E01 | — | SDP text | SDP text | none | Azure OpenAI |
| E07 | WebRTC data channel `realtime-channel` | peer-to-Azure | `useVoiceAgent.ts:164-199` | Realtime events (`response.create`, `response.output_text.delta`, …) | session-bound | — | JSON events | JSON events | none | Azure |
| E08 | WebSocket (SDK) | Azure Speech synthesis | `src/lib/speechOutput.ts:45-47` | Stream TTS audio | Speech token from E01 | — | SSML | PCM 24 kHz | none | Azure Speech |
| E09 | `supabase.auth.signInWithPassword` → POST `/auth/v1/token?grant_type=password` | managed | `AuthContext.tsx:53` | Login | apikey (anon) | — | `{email,password}` | session / 400 | auth | Supabase Auth |
| E10 | `supabase.auth.getSession` / `onAuthStateChange` | local + `/auth/v1/token?grant_type=refresh_token` | `AuthContext.tsx:34-46` | Session restore and refresh | refresh token | — | — | session | auth | Supabase Auth |
| E11 | `supabase.auth.signOut` → POST `/auth/v1/logout` | managed | `AuthContext.tsx:58` | Logout | Bearer | — | — | 204 | auth | Supabase Auth |
| E12 | PostgREST `/rest/v1/profiles` | **never called by the app** | — (table exists only via migration) | — | RLS per user | own row | — | — | `profiles` | — |
| E13 | POST `/auth/v1/signup` | **not used by the app**; probed to confirm it is disabled | — | — | apikey | — | — | 200 or 422 | auth | — |

Total discovered network operations: **13** (11 used by the app, 2 probes of surfaces the app does not call).

## 2. Tests performed and results

Legend: PASS = behaved as the code intends; FAIL = did not; BLOCKED = could not run in this session; UNVERIFIED = not attempted.

| ID | Test | Expected | Result | Evidence |
|---|---|---|---|---|
| E01-a | POST with no Authorization header | 401 | **PASS** `401` | curl 2026-11-16 |
| E01-b | POST with the **publishable key** as bearer (the "bearer alone proves nothing" case the code guards) | 401 | **PASS** `401 {"error":"Unauthorized"}` | curl |
| E01-c | OPTIONS preflight from `http://localhost:5181` | 200/204 with `Access-Control-Allow-Origin: *` | **PASS** `200` | curl |
| E01-d | GET (wrong method) | code does not check method: expect 401 (no bearer) | **PASS** `401 {"error":"Unauthorized"}` | curl |
| E01-e | POST with a valid user JWT | 200 with `token` + `callUrl`, or 500 if Azure secrets missing | UNVERIFIED on purpose: each success mints an Azure Realtime session (cost). Code path reviewed `index.ts:20-85` | code |
| E01-f | Invalid parameters | N/A — endpoint takes no input | N/A | |
| E01-g | Error handling | Any thrown error returns `500 {error: message}` including config-error text such as "AZURE_OPENAI_RESOURCE is not configured" (`index.ts:24-26, 82-85`) — minor information disclosure | IMPLEMENTED (by code) | code |
| E01-h | Timeout | No timeout on the two outbound `fetch` calls (`index.ts:53-72`); Supabase's function limit applies | GAP | code |
| E01-i | Rate limiting | None | GAP | code |
| E09-a | Login with a non-existent account and wrong password | 400 `invalid_credentials`, toast "Login failed" | **PASS** curl `400 {"error_code":"invalid_credentials"}`; browser toast "Login failed — Invalid login credentials" | curl + browser |
| E13 | Signup with a synthetic address | 422/400 "Signups not allowed" if disabled per README | **FAIL (policy)**: the `.invalid` probe address was rejected as malformed (400 `email_address_invalid`) before policy applied, so `GET /auth/v1/settings` was used instead: **`disable_signup: false`**. No account was created. | curl; GAP-S-01 |
| E12 | `GET /rest/v1/profiles?select=id` with anon key only | 200 `[]` (RLS hides rows) | **PASS** `200 []` | curl |
| E10 | Session restore after reload | Console renders without login | PASS: `/console` rendered immediately with a stored `sb-…-auth-token`, expiry refreshed | Browser observation 2026-11-16 |
| E06/E07/E08 | Live WebRTC call and TTS | — | BLOCKED: needs a microphone-enabled interactive session and Azure secrets | — |

## 3. Frontend handling of responses

- `useVoiceAgent.ts:122-125`: any `error`, missing `token` or `callUrl` → thrown → `fail()` → status `error` + toast. Correct.
- `speak.ts:62-65`: any failure of E01 is caught and logged with `console.warn`, then browser speech is used. Correct, but each page visit retries once.
- `AuthContext.tsx:53-55`: error object surfaced to `Login.tsx:37-41` toast. Correct.
- Supabase `functions.invoke` non-2xx returns `error` (FunctionsHttpError) and `data` null; the hook reads `data?.error` first, which will be undefined, then `tokenError.message` ("Edge Function returned a non-2xx status code"). The real server message (e.g. "Unauthorized") is **not shown** to the user. Minor UX gap.

## 4. Summary

| Metric | Count |
|---|---|
| Network operations discovered | 13 |
| Probed | 8 (E01 ×4, E09, E12, E13/settings, OPTIONS) |
| Passed | 7 |
| Failed | 1 (signup policy enabled on the live project) |
| Blocked / unverified | 5 (E03, E04, E06, E07, E08: Azure paths need a microphone session and would spend Azure credit; E02 local function not run) |

Raw output is in TEST_EXECUTION_REPORT.md §4.
