# Vakyam Voice V2 — Backend and Database Audit

## 1. Backend architecture (actual)

| Layer | What exists | Evidence |
|---|---|---|
| Custom API server | **None.** No Express/FastAPI/Next route handlers. | Source tree: only `src/` (Vite SPA) and `supabase/functions/realtime-token` |
| Serverless | One Supabase Edge Function, `realtime-token` (Deno) | `supabase/functions/realtime-token/index.ts` |
| Managed auth | Supabase Auth, email + password | `src/contexts/AuthContext.tsx` |
| Database | Supabase Postgres, project ref `eshtcyzraxojwkzqgqld` | `supabase/config.toml` |
| Frontend data access to DB | **None.** `grep -rn "\.from(\|\.rpc(" src/` returns nothing | grep run 2026-11-16 |
| Console state | Browser `localStorage`, key `vakyam-console-v1` | `src/console/store.tsx:84-115` |

## 2. Schema (from `supabase/migrations/20260112185329_12086946-f404-43dc-aa48-fa16c9746abc.sql`)

### Table `public.profiles`
| Column | Type | Constraint |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | NOT NULL, UNIQUE, FK → `auth.users(id)` ON DELETE CASCADE |
| email | text | |
| display_name | text | |
| created_at | timestamptz | NOT NULL default now() |
| updated_at | timestamptz | NOT NULL default now(), maintained by trigger `update_profiles_updated_at` |

- RLS: **enabled**. Policies: SELECT/UPDATE/INSERT limited to `auth.uid() = user_id`. No DELETE policy (deletes denied by default).
- Trigger `on_auth_user_created` → `handle_new_user()` (SECURITY DEFINER, `search_path = public`) inserts a profile row on signup.
- Indexes: PK on `id`, unique on `user_id`. No others needed at this size.

### Everything else the UI shows
Calls, transcripts, recordings, transfers, QA scores, rubrics, agents/prompt versions, dictionaries, adapters, campaigns, knowledge sources, policy gates, PII settings, disclosure versions, audit log, deletion requests, analytics: **no table exists for any of them**. All of it is either a constant in a `.tsx` file or a field in the localStorage blob.

## 3. Live project inspection

Live listing of tables, RLS policies, migrations and advisors through the Supabase connector was attempted during this audit. Result: **see section 7 (live results)**. If that section says BLOCKED, the listing could not be performed in this session and must be re-run; the migration file above is then the only evidence.

## 4. Persistence classification

| Data | Where it lives | Multi-user safe? | Acceptable for demo? | Acceptable for client? |
|---|---|---|---|---|
| User accounts, sessions | Supabase Auth | Yes | Yes | Yes (with signup disabled) |
| Profile row | Postgres, RLS per user | Yes | Yes | Yes, but unused by the app |
| Every console change (decisions, audit log, gates, PII toggles, adapter statuses, campaigns, dictionary, persona, voice, disclosure text) | localStorage | **No** (shared by anyone on the same browser profile and origin; invisible to colleagues) | Yes | **No** |
| Call records, transcripts, recordings | Nowhere | — | — | **Missing** |
| Realtime call session | Azure, ephemeral | — | — | No call log kept |

## 5. Multi-tenant client readiness

- There is no `organisation`/`tenant`/`desk` column anywhere. The "Club Mahindra desk" and "Pune desk" strings are literals (`ConsoleShell.tsx:192`, `MobileSupervisor.tsx:34`).
- There is no role: every authenticated user is "Kavita Rao, Floor supervisor" (`ConsoleShell.tsx:176`, `store.tsx:81`).
- Tenant isolation for customers, recordings, transcripts, analytics, configuration, audit records, agent settings and knowledge sources: **NOT IMPLEMENTED**, because none of that data is stored server-side at all.
- The only server-side isolation that exists is per-user on `profiles` via RLS.

Verdict: **Not ready for any multi-client use.** A second client organisation would log into the same fictional Club Mahindra console.

## 6. Data integrity, migrations, seed

- One migration, applied in January 2026 per its timestamp. No seed files. No migration for anything the console displays.
- No foreign keys beyond `profiles.user_id`.
- The edge function's "inventory" is generated per calendar week from a hash (`inventory.ts:76-81`): deterministic mock, no DB.

## 7. Live results

The Supabase connector returned `MCP error -32600: You do not have permission to perform this action` for `list_edge_functions`, `list_tables`, `get_advisors` and `list_migrations` on project `eshtcyzraxojwkzqgqld`. Dashboard-level inspection is therefore **BLOCKED** in this session. What could be verified from the outside:

- Edge function `realtime-token` is deployed: `POST /functions/v1/realtime-token` returns the function's own `{"error":"Unauthorized"}` body with 401 (a missing function returns a Supabase 404).
- `profiles` exists and RLS hides rows from the anon role: `GET /rest/v1/profiles?select=id` with the publishable key returns `200 []`.
- Auth settings: email provider on, all OAuth off, anonymous sign-in off, **`disable_signup: false`** (see SECURITY_AUDIT, GAP-S-01).
- Security advisors, index health, and the live migration list must be read by someone with dashboard access before the next session's schema work.
