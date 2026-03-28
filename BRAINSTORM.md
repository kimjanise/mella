# Mella — Hackathon Roadmap

> AI-powered scam-baiting platform that deploys voice agent honeypots, extracts actionable intelligence from scammer calls, and auto-generates law enforcement reports.

---

## Product Overview

Mella has four core components working together:

1. **Voice bots** — Convincing AI personas that answer honeypot numbers, engages scammers in real-time conversation, stalls for time, and naturally surfaces payment and identity intel.
2. **Intelligence extraction pipeline** — a post-call Claude API pipeline that parses transcripts into structured JSON: phone numbers, payment details, scam type, script stage, and more.
3. **Report generator** — automatically populates the standardized .docx intel report template and packages it for FTC / IC3 submission.
4. **Operator dashboard** — a web UI with two screens: Traces (main) and Personas.

**Phone number provisioning:** A free Vapi trial account provides a real dialable phone number instantly — no carrier registration or approval needed. Point it at your assistant in the Vapi dashboard. This is the number used for all demo calls.

## Dashboard — Two Screens

### 1. Traces *(main / landing page)*
The primary operational view. Every call that has ever touched the system appears here as a chronological trace log — similar to a network trace or observability tool.

**Each trace row shows:**
- Timestamp + duration
- Persona used
- Inbound number (ANI)
- Scam type classification (auto-tagged post-call)
- Intel quality badge (High / Medium / Low)
- Call status (Live / Completed / Dropped)

**Row click — detail panel:**
Clicking any trace row slides in a right-side panel (approximately 40% viewport width) without leaving the page. The main trace list remains visible and scrollable on the left. The panel contains:

- **Header:** persona avatar + name, call status badge, timestamp and duration
- **Metadata block:** inbound ANI, spoofed caller ID name, assigned honeypot number, discovery method
- **Intel chips:** all extracted high-value fields surfaced as scannable chips — phone numbers, callback numbers, payment methods, wallet addresses, entity impersonated, scam type
- **Full transcript:** scrollable turn-by-turn view, speaker-labeled (Bot / Scammer), with timestamps per turn
- **Key quotes:** verbatim phrases flagged by the extraction prompt (threats, payment instructions, isolation tactics)
- **Actions:** Download .docx report · File with FTC · File with IC3 · Archive

The panel closes via an X button, clicking outside it, or pressing Escape. Navigating to a different trace row replaces the panel content in place rather than closing and reopening it.

For live calls, the transcript section of the panel streams new turns in real time via SSE — so operators can monitor an active call without leaving the Traces page.

**Implementation note:** The panel is an absolutely-positioned div sliding in from the right with a CSS `transform: translateX` transition. No routing change — URL can optionally update with `?call=<id>` to make panel state shareable/bookmarkable.

**Why it's the main page:** Judges land here and immediately see the system working — active calls pulsing, completed calls with populated intel. Clicking a row reveals the full depth of what the system captured. It's the most compelling first impression.

### 2. Personas
Create and configure bot identities.

- Name, age, backstory, stall tactics
- Voice model selection (ElevenLabs)
- System prompt editor
- Target scam type tags
- Deploy action — associates persona with a Vapi assistant and the Vapi trial phone number

---

## Intelligence Extraction — Target Fields

The post-call Claude prompt should reliably extract the following. Use tool use / JSON mode to enforce schema:

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
  "intel_quality": "medium",
  "confidence": 0.87,
  "key_quotes": [
    "You will be arrested today unless you cooperate",
    "Do not tell your family about this investigation"
  ]
}
```

---

## SQLite Schema

```sql
CREATE TABLE personas (
  id TEXT PRIMARY KEY,
  name TEXT,
  voice_model TEXT,
  system_prompt TEXT,
  target_scam_types TEXT,  -- JSON array
  stall_tactics TEXT,       -- JSON array
  vapi_assistant_id TEXT,
  phone_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  persona_id TEXT REFERENCES personas(id),
  inbound_number TEXT,
  caller_id_name TEXT,
  started_at DATETIME,
  ended_at DATETIME,
  duration_seconds INTEGER,
  status TEXT,              -- live | completed | dropped
  intel_quality TEXT,       -- high | medium | low | null
  scam_type TEXT,
  FOREIGN KEY (persona_id) REFERENCES personas(id)
);

CREATE TABLE transcripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT REFERENCES calls(id),
  turn_index INTEGER,
  speaker TEXT,             -- bot | scammer
  text TEXT,
  timestamp DATETIME
);

CREATE TABLE intel_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT REFERENCES calls(id),
  field_type TEXT,          -- phone | wallet | bank | email | gift_card | quote | etc.
  value TEXT,
  confidence REAL,
  flagged_high_value INTEGER DEFAULT 0
);

CREATE TABLE honeypot_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE,
  persona_id TEXT REFERENCES personas(id),
  discovery_method TEXT,    -- dnc | forwarding | community
  seeded_at DATETIME,
  call_count INTEGER DEFAULT 0
);
```

---

## Key Risks + Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Vapi response latency >1s | High | Cap Claude responses at 2 sentences; cache system prompt; test in H2 |
| Extraction misses fields on short calls | High | Add confidence scores; handle partial JSON gracefully; set minimum call length threshold |
| UI–backend integration blocks Person C | Medium | Person C builds on mock data until H9; never waits for real API |
| Vapi trial number unreachable on stage | Medium | Test inbound call from multiple phones in advance; have pre-recorded fallback call ready |
| Live demo call fails on stage | Medium | Pre-record best call in H18; practice fallback path explicitly |

---

## Scope — In vs Out

### In scope (build this weekend)
- Voice bot conversation via Vapi + Claude + ElevenLabs
- Post-call intel extraction to structured JSON
- .docx report auto-population
- Web dashboard: Traces (with detail panel) and Personas
- Vapi trial number as honeypot
- Demo call recording as fallback

### Out of scope (future roadmap — mention in pitch)
- Live Calls screen, Intel Library screen, Honeypot Numbers screen
- Data broker seeding automation
- DNC registration for organic scam traffic
- Telecom / carrier partner integration
- Real-time mid-call intel extraction
- Multi-call campaign analytics and scammer fingerprinting
- Automated IC3 / FTC API submission
- Mobile app