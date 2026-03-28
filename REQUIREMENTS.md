# Requirements — Mella

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Voice bot answers inbound calls on a Vapi phone number and engages the caller in real-time conversation using a configured persona | Must |
| FR-02 | Bot stalls the scammer while naturally surfacing payment and identity intel (2-sentence response cap for latency) | Must |
| FR-03 | Post-call intelligence extraction parses transcript into structured JSON via Claude API tool use | Must |
| FR-04 | System auto-generates a .docx intel report from extracted data | Must |
| FR-05 | Dashboard — Traces page displays a chronological log of all completed calls | Must |
| FR-06 | Clicking a trace row opens a right-side detail panel (~40% viewport) with call intel | Must |
| FR-07 | Detail panel supports Download .docx, File with FTC, File with IC3, and Archive actions | Must |
| FR-09 | Dashboard — Personas page allows CRUD for bot identities | Must |
| FR-10 | Personas page has a Deploy action that associates a persona with a Vapi assistant and the phone number | Must |
| FR-11 | Detail panel closes via X button, clicking outside, or pressing Escape | Must |
| FR-12 | Selecting a different trace row replaces panel content in place (no close/reopen) | Should |
| FR-13 | URL updates with `?call=<id>` for shareable/bookmarkable panel state | Could |

## Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | Voice bot response latency stays under 1 second perceived delay | Must |
| NFR-02 | Intel extraction handles partial/short transcripts gracefully with confidence scores | Must |
| NFR-03 | Frontend is buildable and testable on mock data without a live backend | Must |
| NFR-04 | Supabase (hosted Postgres) for all persistent storage | Must |
| NFR-05 | A pre-recorded demo call exists as fallback if live demo fails on stage | Must |

---

# Architecture

## Overview

Mella follows a **thin-backend architecture with Supabase as the data layer**. There is no live call streaming — calls appear on the dashboard only after completion.

- **Vapi** handles telephony and real-time voice conversation (FR-01, FR-02)
- **Backend (Hono, TypeScript)** receives a single end-of-call webhook per call, persists data to Supabase, runs Claude extraction, and serves reports (FR-03, FR-04, FR-07, FR-10)
- **Supabase** stores all data and exposes an auto-generated REST API (NFR-04)
- **Frontend (React + Vite, TypeScript)** reads directly from Supabase for all dashboard data; calls backend only for report download and persona deploy (FR-05–FR-13)

```
┌─────────────────────────────────────────────────────────┐
│                    Inbound Phone Call                    │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   Vapi Voice Platform                    │
│          (phone number + assistant config)               │
│                  ElevenLabs voice model                  │
│                 Claude real-time responses               │
│                                                         │
│   End-of-call webhook ───────────────────┐              │
└──────────────────────────────────────────┼──────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (Hono — webhooks + AI)              │
│                                                         │
│  POST /webhooks/vapi ──→ persist call + transcript      │
│                      ──→ Claude extraction ──→ persist   │
│  POST /personas/:id/deploy ──→ Vapi API                 │
│  GET  /calls/:id/report   ──→ generate .docx            │
│                                                         │
└──────────────────┬──────────────────────────────────────┘
                   │ reads/writes via service role key
                   ▼
┌─────────────────────────────────────────────────────────┐
│                       Supabase                           │
│                                                         │
│   Postgres (5 tables)  ·  Auto-generated REST API       │
│   No RLS  ·  No Realtime                                │
│                                                         │
└─────────────────────────┬───────────────────────────────┘
                          │ reads/writes via anon key
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Web Dashboard (React + Vite)                │
│                                                         │
│   /          → Traces page (call log + detail panel)    │
│   /personas  → Personas page (CRUD + deploy)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

All tables live in Supabase Postgres. RLS is disabled — all access is permissive.

```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INTEGER,
  backstory TEXT,
  voice_model TEXT NOT NULL,          -- ElevenLabs voice ID configured in Vapi
  system_prompt TEXT NOT NULL,
  target_scam_types JSONB DEFAULT '[]',  -- e.g. ["irs", "tech_support"]
  stall_tactics JSONB DEFAULT '[]',      -- e.g. ["ask to repeat", "feign confusion"]
  vapi_assistant_id TEXT,             -- set after Deploy; null before
  phone_number TEXT,                  -- Vapi phone number assigned on deploy
  is_active BOOLEAN DEFAULT false,    -- true for the currently deployed persona
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES personas(id),
  vapi_call_id TEXT UNIQUE,           -- Vapi's own call ID from webhook
  inbound_number TEXT,                -- caller's phone number (ANI)
  caller_id_name TEXT,                -- spoofed caller ID name if available
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'completed',    -- only 'completed' for now (no live)
  scam_type TEXT,                     -- set after extraction
  intel_quality TEXT,                 -- high | medium | low | null
  extraction_raw JSONB,              -- full Claude extraction response
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE transcripts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  speaker TEXT NOT NULL,              -- 'bot' | 'scammer'
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ
);

CREATE TABLE intel_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL,           -- phone | callback_number | wallet | bank | email | gift_card | website | quote | badge_number | agent_name | entity_impersonated
  value TEXT NOT NULL,
  metadata JSONB,                     -- type-specific data, e.g. {"brand": "Google Play", "amount": 4200} for gift_card
  confidence REAL,
  flagged_high_value BOOLEAN DEFAULT false
);

CREATE TABLE honeypot_numbers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  phone_number TEXT UNIQUE NOT NULL,
  persona_id UUID REFERENCES personas(id),
  discovery_method TEXT,              -- dnc | forwarding | community
  seeded_at TIMESTAMPTZ DEFAULT now(),
  call_count INTEGER DEFAULT 0
);

CREATE INDEX idx_calls_persona ON calls(persona_id);
CREATE INDEX idx_calls_created ON calls(created_at DESC);
CREATE INDEX idx_transcripts_call ON transcripts(call_id, turn_index);
CREATE INDEX idx_intel_items_call ON intel_items(call_id);
```

## Intelligence Extraction Schema

The Claude API extraction prompt uses tool use to enforce this JSON schema. The backend sends the full transcript and receives structured output:

```json
{
  "scam_type": "IRS impersonation",
  "entity_impersonated": "Internal Revenue Service",
  "agent_name": "Officer Davis",
  "badge_number": "TX-4892",
  "inbound_number": "+12025550183",
  "callback_number": "+19175550147",
  "payment_methods": [
    { "type": "gift_card", "brand": "Google Play", "amount_requested": 4200 }
  ],
  "crypto_wallets": [],
  "bank_details": [],
  "email_addresses": [],
  "websites_mentioned": [],
  "script_stages": ["hook", "fear_escalation", "payment_instruction"],
  "bot_detection_attempts": false,
  "intel_quality": "high | medium | low",
  "confidence": 0.87,
  "key_quotes": [
    "You will be arrested today unless you cooperate",
    "Do not tell your family about this investigation"
  ]
}
```

After extraction, the backend:
1. Stores the full JSON in `calls.extraction_raw`
2. Updates `calls.scam_type` and `calls.intel_quality`
3. Writes individual rows to `intel_items` for each extracted field (one row per phone number, per wallet, per quote, etc.) so the dashboard can render them as chips

## Backend API

### `POST /webhooks/vapi`
Receives Vapi's end-of-call webhook. This is the main ingestion path.

**Flow:**
1. Parse webhook payload (Vapi call object with transcript, metadata, timestamps)
2. Insert `calls` row
3. Insert `transcripts` rows (one per turn)
4. Send transcript to Claude API for extraction
5. Insert `intel_items` rows from extraction result
6. Update `calls` with `scam_type`, `intel_quality`, `extraction_raw`

**Response:** `200 OK` (Vapi expects acknowledgment)

**Error handling:** If extraction fails, the call and transcript are still persisted. `intel_quality` remains null. Extraction can be retried later.

### `POST /personas/:id/deploy`
Associates a persona with a Vapi assistant and activates it on the phone number.

**Request body:** none (persona data is read from Supabase by ID)

**Flow:**
1. Read persona from Supabase
2. If `vapi_assistant_id` is null: create a new Vapi assistant via Vapi API with the persona's `system_prompt` and `voice_model`
3. If `vapi_assistant_id` exists: update the existing Vapi assistant
4. Point the Vapi phone number to this assistant
5. Set `is_active = false` on all other personas, `is_active = true` on this one
6. Write `vapi_assistant_id` and `phone_number` back to Supabase

**Response:** `200 { assistant_id, phone_number }`

### `GET /calls/:id/report`
Generates and returns a .docx intel report for a completed call.

**Flow:**
1. Query Supabase for call, transcripts, and intel_items by call ID
2. Build .docx using the `docx` npm library (programmatic, no template file)
3. Return file as `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Report sections:**
1. **Header** — "Mella Intelligence Report", generated timestamp
2. **Call Summary** — persona name, inbound number, caller ID name, timestamp, duration, scam type, intel quality
3. **Extracted Intelligence** — table of all intel items grouped by field_type
4. **Key Quotes** — bulleted list of flagged quotes
5. **Full Transcript** — turn-by-turn with speaker labels and timestamps
6. **Submission Notes** — placeholder text for FTC/IC3 filing reference numbers

## Frontend

### Routing

React Router with two routes:
- `/` — Traces page (landing)
- `/personas` — Personas page

Navigation between pages via a top nav bar in the Layout component.

### Traces Page (FR-05, FR-06, FR-07, FR-11, FR-12, FR-13)

**Data fetching:** On mount, query Supabase for all calls ordered by `created_at DESC`, joined with persona name. No polling or real-time — user refreshes to see new calls.

**Call log table columns:**
| Column | Source |
|--------|--------|
| Timestamp | `calls.started_at` formatted |
| Duration | `calls.duration_seconds` formatted as mm:ss |
| Persona | `personas.name` via join |
| Inbound Number | `calls.inbound_number` |
| Scam Type | `calls.scam_type` (chip/badge) |
| Intel Quality | `calls.intel_quality` (color-coded badge: green/yellow/gray) |

**Detail panel** opens on row click. Absolutely positioned, slides in from right with `transform: translateX` transition. Contents:

- **Header:** persona name, call status badge, timestamp, duration
- **Metadata block:** inbound number, caller ID name, honeypot number
- **Intel chips:** all `intel_items` for this call rendered as labeled chips, grouped by `field_type`. High-value items (`flagged_high_value`) are visually highlighted.
- **Key quotes:** bulleted list from `intel_items` where `field_type = 'quote'`
- **Full transcript:** scrollable list of turns, each showing speaker label (Bot/Scammer), text, and timestamp
- **Actions:**
  - Download .docx → `GET /calls/:id/report` on backend
  - File with FTC → opens `https://reportfraud.ftc.gov/` in new tab
  - File with IC3 → opens `https://www.ic3.gov/Home/FileComplaint` in new tab
  - Archive → sets a flag on the call (stretch goal, can be a simple Supabase update)

Panel data fetching: on row select, query Supabase for `transcripts` and `intel_items` where `call_id` matches.

### Personas Page (FR-09, FR-10)

**Data fetching:** On mount, query Supabase for all personas ordered by `created_at DESC`.

**Persona form fields:**
| Field | Type | Required |
|-------|------|----------|
| Name | text | yes |
| Age | number | no |
| Backstory | textarea | no |
| Voice Model | text (ElevenLabs voice ID) | yes |
| System Prompt | textarea | yes |
| Target Scam Types | tag input (stored as JSONB array) | no |
| Stall Tactics | tag input (stored as JSONB array) | no |

**CRUD operations:** All go directly through Supabase JS client (insert, update, delete on `personas` table).

**Deploy button:** Calls `POST /personas/:id/deploy` on the backend. Shows the active persona with a visual indicator. Only one persona can be active at a time.

### Mock Data (NFR-03)

`frontend/src/lib/mock-data.ts` exports arrays of fake calls, transcripts, intel_items, and personas matching the database schema. A `USE_MOCK` flag (env var or constant) switches between Supabase client and mock data, so the frontend is fully functional without any backend or Supabase connection.

## Environment Variables

### Backend (`backend/.env`)
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # service role — full write access
ANTHROPIC_API_KEY=sk-ant-...
VAPI_API_KEY=...
VAPI_PHONE_NUMBER_ID=...                # Vapi phone number to assign assistants to
PORT=3001
```

### Frontend (`frontend/.env`)
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...           # anon key — read access + persona CRUD
VITE_BACKEND_URL=http://localhost:3001   # for report download + deploy
VITE_USE_MOCK=false                      # set true for mock-data-only development
```

## File & Folder Structure

```
mella/
├── CLAUDE.md
├── PLANNING.md
├── REQUIREMENTS.md
├── README.md
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env
│   ├── src/
│   │   ├── index.ts                 # Hono server entry, mounts routes
│   │   ├── supabase.ts              # Supabase client init (service role key)
│   │   ├── routes/
│   │   │   ├── webhooks.ts          # POST /webhooks/vapi
│   │   │   ├── deploy.ts            # POST /personas/:id/deploy
│   │   │   └── reports.ts           # GET /calls/:id/report
│   │   └── services/
│   │       ├── extraction.ts        # Claude API intel extraction
│   │       ├── report-generator.ts  # .docx builder using `docx` npm
│   │       └── vapi.ts              # Vapi API client (assistant CRUD, phone number assignment)
│   └── tests/
│       ├── extraction.test.ts
│       └── report-generator.test.ts
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── .env
│   ├── src/
│   │   ├── main.tsx                 # React root + router setup
│   │   ├── supabase.ts              # Supabase client init (anon key)
│   │   ├── lib/
│   │   │   └── mock-data.ts         # Mock data for independent dev
│   │   ├── pages/
│   │   │   ├── Traces.tsx           # Call log table + detail panel
│   │   │   └── Personas.tsx         # Persona CRUD + deploy
│   │   ├── components/
│   │   │   ├── Layout.tsx           # Top nav + page shell
│   │   │   ├── TraceRow.tsx         # Single row in call log
│   │   │   ├── DetailPanel.tsx      # Slide-in panel (right side)
│   │   │   ├── IntelChips.tsx       # Renders intel_items as labeled chips
│   │   │   ├── Transcript.tsx       # Turn-by-turn transcript view
│   │   │   └── PersonaForm.tsx      # Create/edit persona form
│   │   └── styles/
│   │       └── global.css
│   └── tests/
│       └── Traces.test.tsx
├── supabase/
│   └── migrations/
│       └── 001_init.sql             # Full schema from "Database Schema" section above
└── .gitignore
```

## Development Commands

```bash
# Backend
cd backend
npm install
npm run dev          # starts Hono dev server on PORT (default 3001)

# Frontend
cd frontend
npm install
npm run dev          # starts Vite dev server (default 5173)

# Supabase (if using CLI for local dev)
npx supabase start               # local Supabase instance
npx supabase db push              # apply migrations
npx supabase gen types typescript # generate TypeScript types from schema
```

## Testing Strategy

- **Unit tests** — Extraction service: feed sample transcripts, assert correct structured JSON output and confidence scores. Report generator: assert .docx contains expected sections and data fields.
- **Integration tests** — Simulate Vapi webhook payload → verify calls, transcripts, and intel_items rows are written to Supabase correctly.
- **Frontend on mock data** — Set `VITE_USE_MOCK=true`. Dashboard is fully functional against mock data. Verify call log rendering, panel open/close/escape, persona form validation.
- **Manual end-to-end** — Place real inbound calls to the Vapi number. Verify: call completes → webhook fires → data appears in Supabase → dashboard shows call → report downloads correctly.

## Key Technical Decisions

| Decision | Choice | Rationale | Alternative considered |
|----------|--------|-----------|----------------------|
| Backend framework | Hono | Only 3 routes; lightest TS server option | Express (overkill middleware), Fastify (unnecessary validation layer) |
| Frontend framework | React + Vite | Fast HMR, zero-config TS, simple SPA | Next.js (SSR not needed for a dashboard) |
| .docx generation | `docx` npm | Programmatic builder, full TS types, no template file | docxtemplater (template-based), officegen (unmaintained) |
| Database | Supabase | Hosted Postgres + auto REST API; frontend reads directly | SQLite (needs custom API layer, single-machine) |
| Live streaming | None (post-call only) | One webhook per call, no Realtime/SSE/reconnect logic | Supabase Realtime (significant complexity for marginal demo value) |
| Persona ↔ Vapi | One assistant per persona; swap which one the number points to | Cleaner than mutating a single assistant | Single assistant with config swaps |
| Auth | None | Hackathon demo, open access via Supabase anon key | Supabase Auth (available later if needed) |
| Supabase RLS | Disabled | Zero security benefit for a demo; reduces dev friction | Enable post-hackathon |
