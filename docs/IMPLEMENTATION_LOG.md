# Vakyam Voice V2 — Implementation Log

One entry per atomic commit or verified fact. States: IMPLEMENTED (code in repo), TESTED (automated tests pass locally), DEPLOYED (on the target environment), VERIFIED (observed working end to end), BLOCKED, NOT STARTED. Newest at the bottom.

## 2026-11-17 — Phase 0: discovery and baseline

### Repository identity (VERIFIED)
- Path `~/Desktop/Wayam AI/vakyam`; branch `main` tracks `v2/main`; `v2` = `github.com/arkabera2004/Vakyam_voice_V2.git`; `origin` = WayamAI/Vakyam-Voice and is never pushed to.
- HEAD at start: `0863393`, local == remote. Working tree clean except the user's untracked `Screenshot 2026-11-13 at 17.37.52.png` and `docs/vakyam/`, which are never staged.

### Baseline gates on `0863393` (TESTED)
| Gate | Result |
|---|---|
| `tsc -p tsconfig.app.json` / `tsconfig.node.json` | PASS / PASS |
| `eslint .` | 0 errors, 0 warnings |
| `vitest run` | 11 files, 26 tests, 0 skipped |
| `vite build` | PASS |
| `deno check` realtime-token | PASS |
| `npm audit --omit=dev --audit-level=high` | exit 0 (5 moderate, build-time) |
| `npm audit` (all) | 17: 2 critical, 1 high, 14 moderate, all dev tooling (vitest 5 needs Vite ≥ 6) |
| `playwright test` | 20 passed |
| `scripts/check-auth-settings.sh` | **FAIL**: `disable_signup=false` on `eshtcyzraxojwkzqgqld` |

### Live environment (VERIFIED by REST probe with the publishable key)
- Tables present: `profiles` (200). Absent: `voice_sessions`, `organisations`, `org_members`, `agents`, `calls`, `audit_log` (404). None of the three 2026-11-16 migrations is applied.
- Storage: no buckets defined in the repo; bucket listing endpoint answered 200 to the anon role (verify in dashboard that no bucket is public).
- Edge function `realtime-token` deployed in an older form (answers 401 to unauthenticated POST); the rate-limit/speech-only version at HEAD is NOT DEPLOYED.

### Access available in this environment (BLOCKED items)
- No Docker → no local Supabase stack, no `supabase test db`.
- No `supabase login` / `SUPABASE_ACCESS_TOKEN` → no `db push`, no `functions deploy`, no `gen types`, no secrets.
- Supabase MCP connector: permission denied on this project.
- No Azure secrets locally → no live voice verification.
- Dashboard access (signup switch, SMTP) is the user's.

### Decisions recorded
- The 2026-11-16 migrations are unapplied everywhere, so they are edited in place (roles, helpers) rather than layered with ALTER migrations. Once any migration is applied, only additive migrations follow.
- Role model: `super_admin`, `org_admin`, `supervisor`, `agent`, `qa_analyst`, organisation-level, single source in `src/domain/roles.ts` and SQL helpers.
- Domain rules (session state machine, consent gate, retention eligibility, permissions) are written as framework-free modules under `src/domain/` with unit tests, so they are TESTED even while persistence is BLOCKED.

### Commits
| SHA | Change | Tests | Push |
|---|---|---|---|
| (filled per commit below) | | | |
