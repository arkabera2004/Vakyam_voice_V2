# Vakyam Voice V2 — Architecture Overview

Last verified against HEAD on 2026-11-17. Companion documents: `DATA_FLOW.md`, `SECURITY_MODEL.md`, and the audit set under `docs/production-audit/`.

## What the system is

A browser-first AI voice platform. A signed-in member of one organisation talks to a voice agent ("Meera") in the browser; supervisors use a console to govern agents, review sessions, score quality and read analytics.

```
Browser (React 18 + Vite 5 + Tailwind 3, TypeScript)
  ├─ Supabase Auth (email + password, invite-only)
  ├─ PostgREST (RLS-scoped reads/writes per organisation)
  ├─ Supabase Storage (private buckets: recordings, exports)   ← planned, not yet applied
  └─ Edge Function realtime-token (Deno)
        ├─ validates the caller's JWT with Supabase Auth
        ├─ records a voice_sessions row and rate-limits per user
        ├─ mints a short-lived Azure OpenAI Realtime client secret bound to the agent prompt
        └─ optionally mints an Azure Speech token (Indian neural voice)
Azure OpenAI Realtime (WebRTC, audio in / text or audio out)
Azure Speech (TTS over the Speech SDK websocket)
```

## Decisions in force (from the product brief, 2026-11-17)

| Decision | Consequence in code |
|---|---|
| Single organisation now, org boundaries kept | Every domain table carries `org_id`; no tenant provisioning or billing |
| Azure is the voice provider | `realtime-token` + `src/lib/speechOutput.ts`; provider adapter interface isolates Azure |
| Browser voice first, telephony deferred | `calls.channel` defaults to `browser`; no telephony code |
| CRM connector framework, no vendors | Connector contract + mock adapter only; `adapters.is_mock = true` |
| Supabase hosts backend and data | Migrations in `supabase/migrations`, functions in `supabase/functions` |
| Recordings and transcripts persisted | `recordings`, `transcripts`, `transcript_segments` (Phase 7 migration) |
| Invite-only registration | `disable_signup` must be true; CI job `auth-settings` enforces |
| Five roles | `org_members.role ∈ {super_admin, org_admin, supervisor, agent, qa_analyst}` |
| 365-day recording retention, configurable | `retention_policies` + scheduled job with dry-run |
| Consent governed by client policy | `consent_policies` versioned; recording fails safe without an approved policy |

## Source layout

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Routes: `/login`, `/reset`, `/voice`, `/console/*`, 404 |
| `src/contexts/` | Auth provider + `useAuth` |
| `src/hooks/useOrg.ts` | Profile name and organisation membership for the signed-in user |
| `src/hooks/useVoiceAgent.ts` | Browser side of a realtime session (mic, WebRTC, events) |
| `src/lib/speechOutput.ts` | Azure Speech TTS streaming playback |
| `src/console/` | Console shell, state, store barrel, pure helpers (search, export, clock, speak) |
| `src/console/data/` | Demo data and pure routing/policy helpers |
| `src/domain/` | Framework-free business rules (session state machine, consent gate, retention eligibility, roles) with unit tests |
| `src/pages/console/*.tsx` | 13 console screens |
| `supabase/migrations/` | Schema, RLS, seed |
| `supabase/functions/realtime-token/` | Token broker; `limits.ts` holds pure, vitest-covered helpers |
| `supabase/tests/database/` | pgTAP RLS tests (`npx supabase test db`) |
| `e2e/` | Playwright public-surface suite |
| `scripts/` | Operational checks (`check-auth-settings.sh`) |

## State of integration (honest)

| Area | State |
|---|---|
| Auth, route guard, password reset UI | IMPLEMENTED, TESTED (unit + e2e) |
| Token broker, rate limit, speech-only path | IMPLEMENTED, deno-checked; NOT DEPLOYED |
| Domain schema + RLS + seed | WRITTEN, syntax-validated; NOT APPLIED (no CLI login, no Docker) |
| Console screens | Demo data in localStorage; NOT connected to the database |
| Recordings, transcripts, evaluations, analytics, CRM framework | Schema and domain rules in progress; no persistence path yet |
| Live Azure voice | NOT VERIFIED in this environment (no secrets, no microphone session) |
