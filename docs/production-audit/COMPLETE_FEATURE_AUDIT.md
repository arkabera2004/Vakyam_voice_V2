# Vakyam Voice V2 — Complete Feature Audit

Audit date: 2026-11-16. Repository: `~/Desktop/Wayam AI/vakyam`, branch `main`, remote `v2` (github.com/arkabera2004/Vakyam_voice_V2), HEAD `5e56660` at audit start.

Status vocabulary (see EXECUTIVE_SUMMARY.md): IMPLEMENTED, VERIFIED, PARTIALLY VERIFIED, MOCKED, BLOCKED, NOT IMPLEMENTED, FAILED.

## 1. Summary table

| # | Feature | Route | Source files | Frontend | Backend | Data source | Functional status | Evidence | Production readiness |
|---|---|---|---|---|---|---|---|---|---|
| F01 | Login (email + password) | `/login` | `src/pages/Login.tsx`, `src/contexts/AuthContext.tsx` | Complete | Supabase Auth (managed) | Supabase Auth | VERIFIED (wrong credentials rejected; valid session renders console) | Browser: signed-in session for a demo account rendered `/console`; see FRONTEND_ROUTE_AUDIT R02 | Conditional: no password reset, no MFA, no redirect when already signed in |
| F02 | Protected routing | `/console/*`, `/voice` | `src/components/ProtectedRoute.tsx`, `src/App.tsx` | Complete | N/A | Supabase session in localStorage | VERIFIED by code; browser check in FRONTEND_ROUTE_AUDIT | `ProtectedRoute.tsx:20` redirects to `/login` when `user` is null | Ready (as a gate). No role model behind it |
| F03 | Logout | sidebar / header | `ConsoleShell.tsx:182`, `Header.tsx` | Complete | Supabase Auth | — | IMPLEMENTED (`supabase.auth.signOut`) | `AuthContext.tsx:57` | Ready |
| F04 | Voice call to Meera (realtime agent) | `/voice` | `src/pages/Index.tsx`, `src/components/VoiceChatCard.tsx`, `src/hooks/useVoiceAgent.ts`, `src/lib/speechOutput.ts`, `supabase/functions/realtime-token/*` | Complete | Complete (edge function) | Azure OpenAI Realtime via WebRTC; optional Azure Speech TTS | PARTIALLY VERIFIED: token endpoint auth behaviour tested (API_ENDPOINT_AUDIT E01–E04); a live audio call needs a microphone and was not exercised by automation | Endpoint register | Conditional: works only with Azure secrets set on the function; inventory/member data is **MOCK** (`inventory.ts:1-5`) |
| F05 | Console shell: sidebar, search, breadcrumbs, mobile tabs, badges | `/console` | `src/console/ConsoleShell.tsx`, `nav.ts`, `search.ts` | Complete | N/A | Static arrays + localStorage | VERIFIED (renders; search is unit-tested `search.test.ts`) | Browser screenshot of `/console`; 4 search tests pass | Demo only: search indexes 12 hard-coded calls |
| F06 | Home dashboard | `/console` | `src/pages/console/Home.tsx` | Complete | None | Hard-coded KPIs; decisions in localStorage | MOCKED. Decision modal + audit row + CSV export work locally | `Home.tsx:11-16` static `NEEDS_YOU`; `:67-71` static KPIs; date string `:51` is hard-coded "Thursday, 12 November" | Not ready: no data feed |
| F07 | Live calls wall | `/console/live` | `LiveCalls.tsx`, `data/calls.ts`, `data/sortCalls.ts` | Complete | None | 12 hard-coded calls | MOCKED. Sort works (unit-tested); line filter is a no-op (`LiveCalls.tsx:20` comment) | `sortCalls.test.ts` passes | Not ready: no telephony feed |
| F08 | Live call detail: transcript, whisper, barge, take over, tool trace | `/console/live/:id` | `LiveCallDetail.tsx`, `data/transcripts.ts` | Complete | None | Transcripts synthesised from the call's `step` string | MOCKED. Buttons toggle localStorage flags and toasts; no audio path, no telephony control | `transcripts.ts:9-12` "Builds a believable transcript"; `LiveCallDetail.tsx:25-38` | Not ready |
| F09 | Warm transfer desk | `/console/transfers` | `WarmTransfer.tsx` | Complete | None | Hard-coded Rohan Mehta case | MOCKED. Accept/decline/note/refund decision persist in localStorage | `WarmTransfer.tsx:8-26` static content | Not ready |
| F10 | Call review + recording playback | `/console/review` | `CallReview.tsx`, `console/speak.ts` | Complete | Partial (voice preview calls the token function) | Hard-coded transcript for call 4790; "recording" is TTS of transcript | MOCKED. **Defect**: QA "Open" links to `/console/review?call=4783` but the page ignores `?call` and always shows 4790 (`QAScorecards.tsx:150` vs `CallReview.tsx` has no `useSearchParams`) | Code | Not ready |
| F11 | QA scorecards | `/console/qa` | `QAScorecards.tsx` | Complete | None | Static rubric + 8 flagged calls; reviewer assignment in localStorage | MOCKED. Rubric weights are component state only and are lost on refresh (`QAScorecards.tsx:46`, comment `:25`) | Code | Not ready |
| F12 | Agent Studio: persona, prompt versions, dictionary, voice, speed, warmth | `/console/studio` | `AgentStudio.tsx` | Complete | None | localStorage | MOCKED. "Publish v7" changes a string; the real prompt lives in `supabase/functions/realtime-token/prompt.ts` and is untouched. Voice/speed/warmth are never sent to the edge function | `AgentStudio.tsx:43-71`; edge function reads env `AZURE_SPEECH_VOICE` only | Not ready: UI not wired to the agent |
| F13 | Voice preview (opening line, dictionary, samples, disclosure, recording) | studio, compliance, review | `console/speak.ts`, `lib/speechOutput.ts` | Complete | Uses `realtime-token` for an Azure Speech token; falls back to browser `speechSynthesis` | Azure Speech or browser | PARTIALLY VERIFIED: `pickVoice` unit-tested; Azure path depends on function secrets. **Cost note**: every preview mints an Azure *Realtime* client secret just to obtain a Speech token (`speak.ts:52` calls `requestSession`) | Code | Conditional |
| F14 | Tools and integrations | `/console/tools` | `Tools.tsx` | Complete | None | Static adapter list; statuses in localStorage | MOCKED. "Run connection tests" is a 350 ms timer sweep (`Tools.tsx:56` comment). "Configure" accepts a token in a password field and **discards it**; the toast claims "Token is stored server side" (`:73`) which is false | Code | Not ready; misleading copy |
| F15 | Routing rules, call simulator, campaigns | `/console/routing` | `Routing.tsx`, `data/routing.ts` | Complete | None | Static rules; campaigns in localStorage; simulator is a pure function | MOCKED. Simulator logic unit-tested (`routing.test.ts`). Pause/resume/new campaign change localStorage only | Code + tests | Not ready |
| F16 | Knowledge sources, policy gates, policy tester, publish, version history | `/console/knowledge` | `Knowledge.tsx`, `data/policy.ts` | Complete | None | localStorage; tester is regex-based pure function | MOCKED. `answerPolicy` unit-tested (`policy.test.ts`). "Publish" prepends a string to a list | Code + tests | Not ready |
| F17 | Compliance: disclosure edit/approve, PII toggles, deletion request, audit log, export | `/console/compliance` | `Compliance.tsx` | Complete | None | localStorage | MOCKED. Deletion request only writes an audit row; nothing is purged. "DPDP aligned" pill is static text | `Compliance.tsx:49-56`, `:98` | Not ready; compliance claims unverified |
| F18 | Analytics + CSV export + weekly report schedule | `/console/analytics` | `Analytics.tsx` | Complete | None | Static arrays | MOCKED. Filters only rescale static numbers; "Schedule weekly report" stores a string, sends nothing | `Analytics.tsx:9-24`, `:50-56` | Not ready |
| F19 | Mobile supervisor / alerts | `/console/alerts` | `MobileSupervisor.tsx` | Complete | None | Static alerts filtered by localStorage state | MOCKED | Code | Not ready |
| F20 | Demo reset | sidebar | `ConsoleShell.tsx:110`, `store.tsx:121` | Complete | N/A | localStorage | VERIFIED by code (`window.confirm` then `setState(DEFAULT_STATE)`) | Code | Demo feature; must be removed or gated for clients |
| F21 | CSV exports (shift report, QA report, audit log, analytics) | several | `console/export.ts` | Complete | N/A | Static + localStorage rows | VERIFIED: `csvCell`/`toCsv` unit-tested; download uses Blob URL | `export.test.ts` | Ready as a mechanism; content is mock |
| F22 | Notifications bell | header | `ConsoleShell.tsx:193` | Button only | None | — | NOT IMPLEMENTED (no handler) | Code | — |
| F23 | AI cost widget | sidebar | `ConsoleShell.tsx:162-171` | Static | None | Hard-coded "₹1.42L / ₹4L" | MOCKED | Code | — |
| F24 | Marketing landing (header, hero, footer) | `/voice` | `Index.tsx`, `HeroSection.tsx`, `Footer.tsx`, `Header.tsx` | Complete | N/A | — | VERIFIED renders (protected) | Route audit | Ready |
| F25 | 404 page | `*` | `NotFound.tsx` | Complete | N/A | — | VERIFIED (browser: "404 Oops! Page not found") | Route audit R16 | Ready. Logs `console.error` on every hit (`NotFound.tsx:8`) |
| F26 | Branding (logo, favicon, metadata) | all | `src/components/brand/WayamMark.tsx`, `public/favicon.*`, `index.html` | Complete | N/A | — | IMPLEMENTED with the **old Wayam "W" mark**. New official Vakyam logo files not yet supplied (see previous session note) | `src/assets/wayam-icon.svg` | Pending asset delivery |

## 2. Count summary

| Metric | Count |
|---|---|
| Features audited | 26 |
| Verified working end to end (real data path) | 4 (F01 login, F02 route guard, F03 logout, F25 404) + F21 export mechanism |
| Partially verified | 2 (F04 voice call, F13 voice preview) |
| Demo / mock only | 15 (F05–F12, F14–F19, F23) |
| Not implemented | 1 (F22 notifications) |
| Pending external input | 1 (F26 logo assets) |

## 3. Per-feature detail

### F04 Voice call to Meera (`/voice`)
- Intended: a signed-in user talks to Meera (Azure OpenAI Realtime) in the browser over WebRTC.
- Code: `useVoiceAgent.ts` requests `realtime-token` (`:32-42`), gets mic, creates `RTCPeerConnection`, posts SDP to Azure `callUrl` (`:209`), data channel for events. 10-minute hard cut (`:16`). With Azure Speech configured, the model answers in text and `SpeechOutput` speaks it.
- Data: prompt and **mock** member/inventory context are injected server-side (`index.ts:62`, `inventory.ts`).
- Persisted: nothing. No call record, transcript, or recording is stored anywhere.
- Backend: yes, the only custom backend in the project.
- Refresh: call ends (connection torn down on unmount, `:69`).
- Other users: each user mints their own token; nothing shared.
- Verdict: PARTIALLY VERIFIED. Blocked for full verification: needs a microphone session and Azure secrets on the deployed function.

### F08 Live call detail
- Every transcript except call 4821 is generated from the `step` string (`transcripts.ts:13`). Whisper/barge/take-over flip flags in `state.calls[id]` and write an audit row. There is no WebSocket, no telephony API, no audio.
- A control "Take over this call" that only writes localStorage must be classed MOCKED.

### F10 Call review defect
- `QAScorecards.tsx:150`: `navigate(f.call === 4790 ? "/console/review" : \`/console/review?call=${f.call}\`)`.
- `CallReview.tsx` never reads `call` from the URL; the page always shows call 4790. Opening call 4801 from QA shows Anita Iyer's call. Severity: Medium (misleading navigation). Logged as GAP-F-03.

### F12 Agent Studio is not wired to the agent
- The real prompt is `supabase/functions/realtime-token/prompt.ts`, changed by editing the file and redeploying (README "Changing the agent").
- The real voice is the `AZURE_SPEECH_VOICE` / `AZURE_REALTIME_VOICE` secret.
- Studio's persona, dictionary, voice choice, speed and warmth never leave the browser. Marked MOCKED.

### F14 Tools "Configure" token field
- `Tools.tsx:67-76`: `saveConfig` sets a status string and shows "Token is stored server side, never in the prompt". The token is held in React state and dropped. No network call. Any user pasting a real CRM secret here is misled. Logged as GAP-S-04.

### F13 / F10 voice preview cost
- `speak.ts:49-66`: on first play per page visit, `requestSession()` calls the `realtime-token` function, which creates an Azure Realtime `client_secrets` session **and** a Speech token (`index.ts:53-72`). The console only uses the Speech token. Each console preview therefore spends a Realtime session. Logged as GAP-B-05.

## 4. State persistence inventory (all localStorage, key `vakyam-console-v1`)

`store.tsx:9-30` fields: decided, transfer, calls, reviewers, coaching, callbackDone, liveVersion, dictionary, persona, voice, speed, warmth, adapters, campaigns, gates, sources, knowledgeDirty, knowledgeVersions, pii, disclosure, audit, weeklyReport.

- Scope: per browser origin, **not per user**. Two supervisors on one machine share it; the same supervisor on two machines sees different data.
- Audit log (`audit`) is therefore not an audit log in the compliance sense: it is editable client data and is wiped by "Reset demo".
- Acceptable for a demo. Unsuitable for any multi-user client deployment.
