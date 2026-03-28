# Implementation Plan

## Summary
- Total phases: 5
- Total tasks: 14
- Estimated complexity: Medium

## Dependencies
```
1 → 2 → 5 → 8 → 12
1 → 3 → 6 → 9 → 12
1 → 4 → 7 → 10 → 13
         6 → 11
              12 → 14
              13 → 14
```

- Phase 1 (Task 1) is the foundation — everything depends on it
- Phase 2 tasks (2, 3, 4) can all run in parallel
- Phase 3 tasks (5, 6, 7) can all run in parallel
- Phase 4 tasks (8, 9, 10, 11) can mostly run in parallel
- Phase 5 (12, 13, 14) is sequential integration and polish

---

## Phase 1: Foundation

**Goal**: Monorepo scaffolded, both servers start, Supabase schema deployed. A developer can run `npm run dev` in both backend and frontend and see something.

### Task 1: Scaffold monorepo, backend, frontend, and Supabase schema

**Context:** Mella is a hackathon project — an AI-powered scam-baiting platform with a Hono backend, React + Vite frontend, and Supabase (hosted Postgres) database. This task sets up the full project skeleton so all subsequent work has a working foundation to build on. Nothing exists yet — the repo currently contains only planning documents.

**Build:**
1. Create the top-level directory structure: `backend/`, `frontend/`, `supabase/migrations/`, and a root `.gitignore` (ignoring `node_modules`, `.env`, `dist`)
2. Initialize the backend: `package.json` with Hono, `@supabase/supabase-js`, `dotenv`, and `tsx` (dev); `tsconfig.json` targeting ESNext; a `src/index.ts` that starts a Hono server on `PORT` (default 3001) with a health check at `GET /health`; a `src/supabase.ts` that exports an initialized Supabase client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env; `.env.example` listing all required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `PORT`)
3. Initialize the frontend: `npm create vite@latest` with React + TypeScript template; add `@supabase/supabase-js` and `react-router-dom`; create `src/supabase.ts` exporting a client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; set up React Router in `src/main.tsx` with `/` and `/personas` routes rendering placeholder pages; create a `Layout.tsx` with top nav linking both routes; `.env.example` listing all required env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`, `VITE_USE_MOCK`)
4. Create `supabase/migrations/001_init.sql` with the full database schema: 5 tables (`personas`, `calls`, `transcripts`, `intel_items`, `honeypot_numbers`) with all columns, foreign keys, and indexes as specified in the project's requirements document

**Verify:** Run `cd backend && npm install && npm run dev` — server starts and `curl http://localhost:3001/health` returns 200. Run `cd frontend && npm install && npm run dev` — Vite dev server starts and navigating to `http://localhost:5173` shows the layout with nav links to Traces and Personas. Confirm `supabase/migrations/001_init.sql` exists and contains all 5 CREATE TABLE statements.

---

## Phase 2: Core Services (parallel)

**Goal**: The three backend services work independently — Claude extraction returns structured JSON from a transcript, the report generator produces a valid .docx, and the Vapi client can create/update assistants. None are wired to routes yet.

### Task 2: Intelligence extraction service

**Context:** Mella is an AI scam-baiting platform. After a scam call ends, the system sends the full conversation transcript to Claude API to extract structured intelligence — scam type, phone numbers, payment methods, crypto wallets, key quotes, and confidence scores. This service is the core AI component of the backend. It lives at `backend/src/services/extraction.ts` in a Hono + TypeScript backend that already has `@anthropic-ai/sdk` available.

**Build:**
1. Install `@anthropic-ai/sdk` in the backend. Create `backend/src/services/extraction.ts` exporting an `extractIntel(transcript: string)` function that sends the transcript to Claude API using tool use to enforce the extraction JSON schema. The tool definition should declare all fields: `scam_type`, `entity_impersonated`, `agent_name`, `badge_number`, `inbound_number`, `callback_number`, `payment_methods` (array of `{type, brand, amount_requested}`), `crypto_wallets`, `bank_details`, `email_addresses`, `websites_mentioned`, `script_stages`, `bot_detection_attempts`, `intel_quality` (enum: high/medium/low), `confidence` (0-1 float), and `key_quotes` (string array)
2. Handle partial/short transcripts gracefully: if the transcript is very short (under ~3 turns), set `intel_quality` to "low" and `confidence` below 0.5. If Claude returns no tool use (extraction failed), return a fallback object with null fields and `intel_quality: null`
3. Create `backend/tests/extraction.test.ts` with at least two test cases: one with a realistic IRS scam transcript (10+ turns) asserting the result contains `scam_type`, at least one `payment_methods` entry, and `intel_quality` of "medium" or "high"; one with a 2-turn transcript asserting `intel_quality` is "low"

**Verify:** Run `cd backend && npm test -- extraction` — both test cases pass. The test with the full transcript returns a result where `scam_type` is a non-empty string and `payment_methods` is a non-empty array.

### Task 3: Report generator service

**Context:** Mella is an AI scam-baiting platform that generates .docx intel reports from completed scam calls for law enforcement submission (FTC/IC3). The report generator takes call data, transcript, and extracted intel and produces a downloadable Word document. It lives at `backend/src/services/report-generator.ts` in a Hono + TypeScript backend. The `docx` npm package is used for programmatic document building (no template files).

**Build:**
1. Install the `docx` npm package in the backend. Create `backend/src/services/report-generator.ts` exporting a `generateReport(call, transcripts, intelItems, personaName)` function that returns a `Buffer` containing a valid .docx file
2. The report must contain 6 sections in order: (1) Header with "Mella Intelligence Report" title and generated timestamp, (2) Call Summary with persona name, inbound number, caller ID name, start time, duration, scam type, intel quality, (3) Extracted Intelligence as a table of intel items grouped by `field_type`, (4) Key Quotes as a bulleted list of items where `field_type === 'quote'`, (5) Full Transcript turn-by-turn with speaker labels (Bot/Scammer) and timestamps, (6) Submission Notes with placeholder text for FTC/IC3 filing reference numbers
3. Create `backend/tests/report-generator.test.ts` that passes sample call data, 5 transcript turns, and 3 intel items to `generateReport`, then asserts the returned buffer is non-empty and starts with the .docx magic bytes (`PK` — zip header)

**Verify:** Run `cd backend && npm test -- report-generator` — test passes. The generated buffer starts with bytes `50 4B` (PK zip signature), confirming it's a valid .docx file.

### Task 4: Vapi API client service

**Context:** Mella is an AI scam-baiting platform that uses Vapi for telephony. Each bot persona maps to a Vapi assistant. The "Deploy" action creates or updates a Vapi assistant and assigns it to the phone number so incoming calls route to that persona. This service wraps the Vapi REST API. It lives at `backend/src/services/vapi.ts` in a Hono + TypeScript backend.

**Build:**
1. Create `backend/src/services/vapi.ts` exporting three functions: `createAssistant(systemPrompt, voiceModel)` that POSTs to the Vapi API to create an assistant configured with Claude as the model, the given ElevenLabs voice, and the system prompt (with a 2-sentence response length instruction appended); `updateAssistant(assistantId, systemPrompt, voiceModel)` that PATCHes an existing assistant; and `assignPhoneNumber(phoneNumberId, assistantId)` that PATCHes the Vapi phone number to point to the given assistant
2. All three functions should use `fetch` with the `VAPI_API_KEY` from env as Bearer token, targeting the Vapi API base URL `https://api.vapi.ai`. Each function should throw a descriptive error if the API returns a non-2xx status, including the response body for debugging
3. Export TypeScript types for the Vapi assistant create/update payloads and responses based on the Vapi API structure (assistant ID, phone number ID, model config, voice config)

**Verify:** Run `cd backend && npx tsc --noEmit` — the file compiles with no type errors. Manually verify the code makes requests to the correct Vapi API endpoints (`POST /assistant`, `PATCH /assistant/:id`, `PATCH /phone-number/:id`) with correct auth header structure.

---

## Phase 3: Backend Routes + Frontend Mock Data (parallel)

**Goal**: All three backend routes are functional. The frontend renders both pages with realistic mock data. Backend and frontend can be developed and verified independently.

### Task 5: Webhook route — ingest Vapi end-of-call data

**Context:** Mella is an AI scam-baiting platform with a Hono + TypeScript backend that uses Supabase for storage. When a scam call ends, Vapi sends an end-of-call webhook containing the full transcript and call metadata. The webhook route is the main data ingestion path — it persists the call and transcript to Supabase, then runs Claude extraction to extract and persist structured intelligence. The backend already has working services for Supabase client (`src/supabase.ts`) and intelligence extraction (`src/services/extraction.ts`).

**Build:**
1. Create `backend/src/routes/webhooks.ts` exporting a Hono route group. Implement `POST /webhooks/vapi` that parses the Vapi webhook JSON body, extracts call metadata (Vapi call ID, phone number, caller ID name, start/end timestamps, duration) and the transcript array from the payload
2. The handler should: (a) insert a row into `calls` with the extracted metadata and `status: 'com
pleted'`, (b) insert one row per transcript turn into `transcripts` with `turn_index`, `speaker` (mapping Vapi's role labels to 'bot'/'scammer'), and `text`, (c) call the extraction service with the full transcript text, (d) insert `intel_items` rows from the extraction result — one row per phone number, callback number, wallet, email, website, quote, payment method, etc. with appropriate `field_type` and `metadata`, (e) update the `calls` row with `scam_type`, `intel_quality`, and `extraction_raw`
3. If the extraction service fails or throws, the call and transcript should still be persisted. Log the error and leave `intel_quality` as null. The route must always return `200 OK` to Vapi regardless of extraction success.
4. Mount the webhook routes in `backend/src/index.ts`

**Verify:** Start the backend with `npm run dev`. Send a POST request with `curl -X POST http://localhost:3001/webhooks/vapi -H 'Content-Type: application/json' -d '{"message":{"type":"end-of-call-report","call":{"id":"test-123","startedAt":"2024-01-01T00:00:00Z","endedAt":"2024-01-01T00:05:00Z","customer":{"number":"+15551234567"}},"transcript":[{"role":"assistant","message":"Hello this is Margaret"},{"role":"user","message":"This is the IRS you owe back taxes"}]}'` — returns 200 and the call appears in Supabase.

### Task 6: Frontend mock data and Traces page

**Context:** Mella is an AI scam-baiting platform with a React + Vite + TypeScript frontend that reads from Supabase. The Traces page is the main landing page — it shows a chronological table of completed scam calls. Clicking a row opens a slide-in detail panel showing call metadata, extracted intelligence chips, key quotes, full transcript, and action buttons. The frontend needs to work with mock data (no backend or Supabase needed) by toggling `VITE_USE_MOCK=true`. The frontend already has React Router set up with `/` rendering a placeholder Traces page, and `@supabase/supabase-js` installed.

**Build:**
1. Create `frontend/src/lib/mock-data.ts` exporting realistic mock arrays: 5 calls (with varying scam types, intel quality levels, and durations), 8-12 transcript turns per call, 3-6 intel items per call (mix of phone, quote, gift_card, entity_impersonated types), and 2 personas. All data should match the Supabase schema types (UUIDs, TIMESTAMPTZ strings, JSONB fields). Create a data access layer (`frontend/src/lib/data.ts` or similar) that checks `VITE_USE_MOCK` — if true, returns mock data; if false, queries Supabase
2. Build the Traces page at `frontend/src/pages/Traces.tsx`: a table displaying all calls ordered by most recent, with columns for timestamp, duration (formatted mm:ss), persona name, inbound number, scam type (as a colored chip), and intel quality (color-coded badge: green for high, yellow for medium, gray for low). Each row is clickable
3. Build the detail panel as `frontend/src/components/DetailPanel.tsx`: an absolutely-positioned div that slides in from the right (~40% viewport width) with a CSS `transform: translateX` transition. It should close on X button click, clicking outside the panel, or pressing Escape. Clicking a different row should replace panel content without close/reopen animation. The panel contains: header (persona name, timestamp, duration), metadata block (inbound number, caller ID name), intel chips (rendered by an `IntelChips.tsx` component — labeled chips grouped by type, high-value items highlighted), key quotes (bulleted list), full transcript (`Transcript.tsx` — scrollable turn-by-turn with Bot/Scammer labels), and action buttons (Download .docx, File with FTC, File with IC3, Archive — FTC/IC3 open external URLs in new tabs, Download and Archive are non-functional placeholders for now)

**Verify:** Run `cd frontend && VITE_USE_MOCK=true npm run dev`. Navigate to `http://localhost:5173` — the Traces page shows a table with 5 mock calls. Click a row — the detail panel slides in from the right showing intel chips, transcript, and action buttons. Press Escape — the panel closes. Click a different row — the panel content updates without a close/reopen flicker.

### Task 7: Deploy route and report download route

**Context:** Mella is an AI scam-baiting platform with a Hono + TypeScript backend, Supabase for storage, and services for Vapi API interaction (`src/services/vapi.ts`) and .docx report generation (`src/services/report-generator.ts`). Two backend routes remain: one to deploy a persona (create/update a Vapi assistant and assign it to the phone number), and one to generate and download a .docx intel report for a completed call. Both read from Supabase and call existing services.

**Build:**
1. Create `backend/src/routes/deploy.ts` implementing `POST /personas/:id/deploy`. It should read the persona from Supabase by ID, call `createAssistant` or `updateAssistant` (depending on whether `vapi_assistant_id` is null), call `assignPhoneNumber` to point the Vapi phone number to this assistant, set `is_active = false` on all personas then `is_active = true` on this one, and write back `vapi_assistant_id` and `phone_number`. Return `200 { assistant_id, phone_number }`.
2. Create `backend/src/routes/reports.ts` implementing `GET /calls/:id/report`. It should query Supabase for the call (joined with persona name), its transcripts (ordered by turn_index), and its intel_items. Pass all data to `generateReport()`. Return the buffer with content type `application/vnd.openxmlformats-officedocument.wordprocessingml.document` and a `Content-Disposition` header for file download (filename: `mella-report-{call_id}.docx`).
3. Mount both route groups in `backend/src/index.ts`. Add CORS middleware to the Hono app (allow the frontend origin) since the frontend will call these routes directly.

**Verify:** Start the backend with `npm run dev`. Run `curl -I http://localhost:3001/calls/nonexistent-id/report` — returns 404 or appropriate error (not a 500 crash). Run `npx tsc --noEmit` — no type errors across all route files.

---

## Phase 4: Frontend Pages + Backend Integration (parallel)

**Goal**: Personas page is fully functional with Supabase CRUD. Traces page connects to real Supabase data. Report download works end-to-end. Deploy calls the backend.

### Task 8: Connect Traces page to Supabase

**Context:** Mella is an AI scam-baiting platform with a React + Vite + TypeScript frontend. The Traces page already renders a call log table and slide-in detail panel using mock data (controlled by a `VITE_USE_MOCK` flag). The frontend has a Supabase JS client initialized at `src/supabase.ts`. This task wires the Traces page to read real data from Supabase when `VITE_USE_MOCK` is false, and connects the Download .docx button to the backend's report endpoint.

**Build:**
1. Update the data access layer to implement the Supabase path: query `calls` joined with `personas.name`, ordered by `created_at DESC`. On row select, query `transcripts` (ordered by `turn_index`) and `intel_items` filtered by `call_id`. All queries use the Supabase JS client with the anon key.
2. Wire the "Download .docx" action button in the detail panel to `GET {VITE_BACKEND_URL}/calls/{id}/report` — fetch the response as a blob and trigger a browser file download with the returned filename
3. Implement the `?call=<id>` URL parameter: on page load, if the query param is present, auto-select that call and open the detail panel. When a row is selected, update the URL with `?call=<id>` using `replaceState` (no navigation). When the panel closes, remove the query param.

**Verify:** With a Supabase project containing at least one call (seeded or from a webhook test), set `VITE_USE_MOCK=false` and run the frontend. The Traces page loads and displays calls from Supabase. Click a row — the detail panel shows real transcript and intel data. Navigate to `/?call=<valid-id>` — the panel opens automatically for that call.

### Task 9: Personas page with Supabase CRUD

**Context:** Mella is an AI scam-baiting platform with a React + Vite + TypeScript frontend that uses Supabase for storage. The Personas page lets operators create, edit, and delete bot personas (name, age, backstory, voice model, system prompt, target scam types, stall tactics). CRUD goes directly through the Supabase JS client. A Deploy button calls the Hono backend to create a Vapi assistant and assign it to the phone number. The frontend already has React Router with `/personas` rendering a placeholder, and a Supabase client at `src/supabase.ts`.

**Build:**
1. Build the Personas page at `frontend/src/pages/Personas.tsx`: on mount, fetch all personas from Supabase ordered by `created_at DESC`. Display them as cards or a list, each showing name, scam type tags, active/inactive status, and edit/delete/deploy buttons
2. Build `frontend/src/components/PersonaForm.tsx`: a form with fields for name (text, required), age (number, optional), backstory (textarea, optional), voice model (text, required — ElevenLabs voice ID), system prompt (textarea, required), target scam types (comma-separated input stored as JSONB array), and stall tactics (comma-separated input stored as JSONB array). The form handles both create (insert into `personas`) and edit (update `personas` by ID) via Supabase JS client. After save, refresh the persona list
3. Wire the Deploy button to call `POST {VITE_BACKEND_URL}/personas/{id}/deploy`. On success, update the local state to show this persona as active (green indicator) and all others as inactive. Wire the Delete button to delete from Supabase (with a confirmation prompt). Show the currently active persona prominently

**Verify:** Run the frontend with `VITE_USE_MOCK=false`. Navigate to `/personas`. Create a new persona by filling the form and saving — it appears in the list. Edit it — changes persist after page refresh. Delete it — it disappears. (Deploy can only be verified with valid Vapi credentials.)

### Task 10: Persona deploy end-to-end

**Context:** Mella is an AI scam-baiting platform where each bot persona maps to a Vapi voice assistant. The backend has a `POST /personas/:id/deploy` route that creates/updates a Vapi assistant and assigns it to the phone number. The frontend Personas page has a Deploy button that calls this route. This task verifies and fixes the full deploy flow end-to-end with real Vapi credentials, ensuring a deployed persona's assistant actually receives inbound calls.

**Build:**
1. Verify the Vapi service (`backend/src/services/vapi.ts`) creates assistants with the correct payload structure by consulting the Vapi API docs — ensure the model is set to Claude, the voice is set to the ElevenLabs voice ID from the persona, and the system prompt includes the 2-sentence response cap instruction. Fix any payload structure issues.
2. Verify the deploy route correctly writes back `vapi_assistant_id` and sets `is_active` in Supabase after a successful Vapi API call. Ensure error cases (invalid persona ID, Vapi API failure) return appropriate HTTP status codes and error messages to the frontend.
3. Test the full flow: create a persona in the dashboard, click Deploy, confirm the Vapi assistant is created (check Vapi dashboard or API), confirm the phone number is pointed at it, and confirm calling the number reaches the assistant.

**Verify:** With valid Vapi credentials in `.env`, create a persona via the frontend, click Deploy, and verify that `vapi_assistant_id` is written to the persona row in Supabase (check via Supabase dashboard or `select vapi_assistant_id from personas where is_active = true`). Call the Vapi phone number and confirm it answers with the persona's voice/prompt.

### Task 11: Seed data script for demo

**Context:** Mella is an AI scam-baiting platform with a Supabase database. For hackathon demo and development, the dashboard needs to look populated with realistic completed scam calls including transcripts and extracted intelligence. This task creates a seed script that inserts realistic demo data directly into Supabase so the Traces page looks compelling even before any real calls come in.

**Build:**
1. Create `backend/src/seed.ts` — a standalone script (runnable with `npx tsx src/seed.ts`) that inserts demo data into Supabase: 2 personas (e.g. "Margaret, 78, retired teacher" and "Harold, 82, retired accountant"), 4-5 completed calls with varying scam types (IRS impersonation, tech support, Social Security), realistic 10-15 turn transcripts for each call, and 4-8 intel items per call covering different field types (phone, gift_card, quote, entity_impersonated, badge_number). Include varied intel quality levels (2 high, 2 medium, 1 low).
2. The script should be idempotent — check if seed data already exists (e.g. by a known `vapi_call_id` prefix like `seed-`) and skip insertion if so. Add a `--force` flag that deletes existing seed data before reinserting.
3. Add an `npm run seed` script to `backend/package.json`

**Verify:** Run `cd backend && npm run seed`. Check Supabase — personas, calls, transcripts, and intel_items tables are populated. Run it again without `--force` — no duplicate data inserted. Run the frontend Traces page — seed calls appear with full detail panels.

---

## Phase 5: Integration, Polish, Demo Readiness

**Goal**: End-to-end flow works: a real call through Vapi → webhook → extraction → dashboard display → report download. Demo fallback is in place.

### Task 12: End-to-end webhook integration test

**Context:** Mella is an AI scam-baiting platform. The full inbound call pipeline is: a call ends on Vapi → Vapi fires an end-of-call webhook to the Hono backend → backend persists call and transcript to Supabase → backend runs Claude extraction → backend persists intel items to Supabase → the React frontend's Traces page displays the call with full detail. All individual pieces (webhook route, extraction service, Supabase writes, Traces page) are built. This task verifies they work together as a single flow.

**Build:**
1. Write an integration test or script (`backend/tests/webhook-e2e.test.ts`) that sends a realistic Vapi end-of-call webhook payload to `POST /webhooks/vapi` on the running backend, then queries Supabase to verify: a `calls` row was created with correct metadata, `transcripts` rows exist with correct turn count and speaker labels, `intel_items` rows exist with at least one extracted field, and `calls.scam_type` and `calls.intel_quality` are non-null
2. If any step fails — for example, the Vapi webhook payload structure doesn't match what the handler expects — fix the webhook handler to match the actual Vapi format. Consult Vapi API documentation for the exact end-of-call report payload structure.
3. After the backend test passes, verify the frontend displays the new call: load the Traces page, confirm the test call appears in the table, click it, and confirm the detail panel shows transcript and intel chips

**Verify:** Run the integration test — it passes, confirming a webhook payload results in fully populated calls, transcripts, and intel_items rows in Supabase. Load the frontend Traces page — the test call appears with a non-null scam type badge and intel quality indicator.

### Task 13: Live call end-to-end test

**Context:** Mella is an AI scam-baiting platform that uses Vapi for telephony with Claude + ElevenLabs for voice conversation. The full system is built: Vapi assistant (deployed persona), webhook route, Claude extraction, Supabase persistence, and React dashboard. This task verifies the entire pipeline works with a real phone call — not a simulated webhook, but an actual inbound call to the Vapi phone number that generates a real transcript.

**Build:**
1. Ensure a persona is deployed (has a `vapi_assistant_id` and the phone number is pointed at it). If not, deploy one via the frontend's Personas page.
2. Ensure the backend is running and its webhook URL is configured in the Vapi dashboard as the server URL (or use a tunnel like ngrok to expose the local backend). Verify the Vapi assistant's "server URL" or "webhook URL" setting points to `{backend_url}/webhooks/vapi`.
3. Place a real phone call to the Vapi number. Simulate a brief scam interaction (2-3 minutes). After hanging up, verify the call appears in Supabase and on the Traces page dashboard with extracted intelligence. Record this call's details for use as the demo fallback.

**Verify:** After the call ends, within 30 seconds the call should appear in Supabase with `status: 'completed'`, `scam_type` non-null, and at least one `intel_items` row. The Traces page (after refresh) shows the call with a populated detail panel.

### Task 14: Demo fallback recording and final polish

**Context:** Mella is an AI scam-baiting platform being presented at a hackathon. Live demos can fail — Vapi could be unreachable, the network could drop, or the scam persona might not perform well under pressure. This task ensures there's a pre-recorded fallback and that the dashboard is demo-ready: polished enough to impress judges, with no broken states or empty screens.

**Build:**
1. From the live call test (or the seed data), identify the single best call — one with high intel quality, diverse extracted fields, and a convincing transcript. Ensure this call is in Supabase and displays well on the dashboard. Note its call ID for the `?call=<id>` deep link so the demo can jump straight to it.
2. Audit the frontend for demo polish: ensure the Traces page loads without errors or empty states when data exists, the detail panel animates smoothly, intel chips render with proper labels and colors, the transcript is readable, and the .docx report downloads successfully. Fix any visual bugs, broken layouts, or console errors.
3. Write a brief demo script in the README.md (or a DEMO.md): the Vapi phone number to call, the deep link URL to the best call, the fallback walkthrough steps if the live call fails (navigate to Traces, click the pre-populated call, show the detail panel, download the report).

**Verify:** Open the dashboard fresh (hard refresh, cleared cache). The Traces page loads with populated calls. Click the best call — the detail panel opens with full intel, transcript, and working action buttons. Download the .docx report — it opens in a word processor with all 6 sections populated. Open `/?call=<best-call-id>` in a new incognito tab — the panel auto-opens to the correct call.
