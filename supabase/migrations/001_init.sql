CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INTEGER,
  backstory TEXT,
  voice_model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  target_scam_types JSONB DEFAULT '[]',
  stall_tactics JSONB DEFAULT '[]',
  vapi_assistant_id TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES personas(id),
  vapi_call_id TEXT UNIQUE,
  inbound_number TEXT,
  caller_id_name TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'completed',
  scam_type TEXT,
  intel_quality TEXT,
  extraction_raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE transcripts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ
);

CREATE TABLE intel_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL,
  value TEXT NOT NULL,
  metadata JSONB,
  confidence REAL,
  flagged_high_value BOOLEAN DEFAULT false
);

CREATE TABLE honeypot_numbers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  phone_number TEXT UNIQUE NOT NULL,
  persona_id UUID REFERENCES personas(id),
  discovery_method TEXT,
  seeded_at TIMESTAMPTZ DEFAULT now(),
  call_count INTEGER DEFAULT 0
);

CREATE INDEX idx_calls_persona ON calls(persona_id);
CREATE INDEX idx_calls_created ON calls(created_at DESC);
CREATE INDEX idx_transcripts_call ON transcripts(call_id, turn_index);
CREATE INDEX idx_intel_items_call ON intel_items(call_id);
