# Vakyam Voice V2 — Data Flow

## 1. Sign-in

1. `/login` → `supabase.auth.signInWithPassword` → session stored in `localStorage` (`sb-<ref>-auth-token`).
2. `AuthProvider` subscribes to `onAuthStateChange`; `ProtectedRoute` redirects to `/login` when there is no user.
3. `useOrg()` reads `profiles` (own row, RLS) and the first `org_members` row with its organisation. Until the domain migration is applied the second query 404s and the hook degrades to name-only.

## 2. Browser voice session (current)

```
VoiceChatCard ─click─▶ useVoiceAgent.startCall
   ├─ getUserMedia (mic)
   └─ requestSession() ─▶ supabase.functions.invoke("realtime-token", {speechOnly:false})
         Edge function:
           1. GET /auth/v1/user with the caller's JWT            (401 if not a user)
           2. GET /rest/v1/voice_sessions?created_at=gte.<1h>    count=exact, caller's JWT
           3. 429 if count ≥ VOICE_SESSIONS_PER_HOUR
           4. POST /rest/v1/voice_sessions {kind}                (RLS: own row)
           5. POST Azure client_secrets (instructions = prompt + mock inventory)
           6. POST Azure Speech issueToken (optional)
           7. → {token, callUrl, firstMessage, speech?}
   ├─ RTCPeerConnection ⇄ Azure (SDP via callUrl, bearer = ephemeral token)
   ├─ data channel "realtime-channel": response.create, output_text.delta, speech_started …
   └─ SpeechOutput (Azure Speech SDK) speaks text deltas when `speech` is present
```

Nothing about the conversation is persisted today beyond the `voice_sessions` row (and only once the migration is applied). Phase 6/7 add `calls`, `call_turns`, `recordings`, `transcripts`.

## 3. Console preview voice

`useSpeaker()` → `requestSession(true)` → function returns only `{speech}`; no realtime session is created. Falls back to `window.speechSynthesis` when Azure Speech is not configured.

## 4. Console state (current)

All 13 screens read constants from their page files and `src/console/state.ts`, and write every change to `localStorage["vakyam-console-v1"]` through `ConsoleProvider`. The `audit` array in that blob is the on-screen audit log. This is demo-only and is the subject of Phases 3–9.

## 5. Target flow after Phases 1–9

```
invite ─▶ auth.users ─trigger─▶ profiles ─▶ org_members(role)
agent config ─▶ agents / agent_versions (immutable rows; sessions reference version id)
session ─▶ calls(state machine) ─▶ call_events ─▶ recordings (Storage, private) ─▶ transcripts/segments
         ─▶ evaluations (template version, criterion scores, evidence segment ids) ─▶ human review (audited)
analytics ─▶ SQL views over calls/evaluations/usage_records, filtered by org, date, agent, status
retention job ─▶ eligible recordings (policy) ─▶ dry-run report ─▶ deletion + deletion_audit
```

Every write that matters for governance goes through `log_audit()` (append-only, stamped with `auth.uid()`).
