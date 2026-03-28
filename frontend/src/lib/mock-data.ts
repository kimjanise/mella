export interface Persona {
  id: string;
  name: string;
  age: number | null;
  backstory: string | null;
  voice_model: string;
  system_prompt: string;
  target_scam_types: string[];
  stall_tactics: string[];
  vapi_assistant_id: string | null;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Call {
  id: string;
  persona_id: string;
  vapi_call_id: string;
  inbound_number: string | null;
  caller_id_name: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  status: string;
  scam_type: string | null;
  intel_quality: string | null;
  extraction_raw: unknown;
  created_at: string;
  personas?: { name: string };
}

export interface Transcript {
  id: number;
  call_id: string;
  turn_index: number;
  speaker: string;
  text: string;
  timestamp: string | null;
}

export interface IntelItem {
  id: number;
  call_id: string;
  field_type: string;
  value: string;
  metadata: Record<string, unknown> | null;
  confidence: number | null;
  flagged_high_value: boolean;
}

export const mockPersonas: Persona[] = [
  {
    id: "p-001",
    name: "Margaret",
    age: 78,
    backstory: "Retired schoolteacher from Ohio. Lives alone, hard of hearing, trusting.",
    voice_model: "EXAVITQu4vr4xnSDxMaL",
    system_prompt: "You are Margaret, a 78-year-old retired teacher. You are trusting and a bit confused by technology.",
    target_scam_types: ["irs", "tech_support"],
    stall_tactics: ["ask to repeat", "feign confusion", "tell stories"],
    vapi_assistant_id: "ast-001",
    phone_number: "+18005551234",
    is_active: true,
    created_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "p-002",
    name: "Harold",
    age: 82,
    backstory: "Retired accountant from Florida. Meticulous but slow with technology.",
    voice_model: "TX3LPaxmHKxFdv7VOQHJ",
    system_prompt: "You are Harold, an 82-year-old retired accountant. You are methodical and ask lots of questions.",
    target_scam_types: ["social_security", "irs"],
    stall_tactics: ["ask for spelling", "request official documentation", "check with spouse"],
    vapi_assistant_id: null,
    phone_number: null,
    is_active: false,
    created_at: "2024-06-02T14:30:00Z",
  },
];

export const mockCalls: Call[] = [
  {
    id: "c-001",
    persona_id: "p-001",
    vapi_call_id: "vapi-call-001",
    inbound_number: "+12025550183",
    caller_id_name: "IRS Department",
    started_at: "2024-06-15T14:30:00Z",
    ended_at: "2024-06-15T14:37:00Z",
    duration_seconds: 420,
    status: "completed",
    scam_type: "IRS impersonation",
    intel_quality: "high",
    extraction_raw: null,
    created_at: "2024-06-15T14:37:00Z",
    personas: { name: "Margaret" },
  },
  {
    id: "c-002",
    persona_id: "p-001",
    vapi_call_id: "vapi-call-002",
    inbound_number: "+19175550147",
    caller_id_name: "Windows Support",
    started_at: "2024-06-15T15:10:00Z",
    ended_at: "2024-06-15T15:18:00Z",
    duration_seconds: 480,
    status: "completed",
    scam_type: "Tech support",
    intel_quality: "medium",
    extraction_raw: null,
    created_at: "2024-06-15T15:18:00Z",
    personas: { name: "Margaret" },
  },
  {
    id: "c-003",
    persona_id: "p-002",
    vapi_call_id: "vapi-call-003",
    inbound_number: "+13125550199",
    caller_id_name: null,
    started_at: "2024-06-16T09:05:00Z",
    ended_at: "2024-06-16T09:12:00Z",
    duration_seconds: 420,
    status: "completed",
    scam_type: "Social Security",
    intel_quality: "high",
    extraction_raw: null,
    created_at: "2024-06-16T09:12:00Z",
    personas: { name: "Harold" },
  },
  {
    id: "c-004",
    persona_id: "p-001",
    vapi_call_id: "vapi-call-004",
    inbound_number: "+14085550123",
    caller_id_name: "Amazon Prime",
    started_at: "2024-06-16T11:20:00Z",
    ended_at: "2024-06-16T11:23:00Z",
    duration_seconds: 180,
    status: "completed",
    scam_type: "Amazon impersonation",
    intel_quality: "low",
    extraction_raw: null,
    created_at: "2024-06-16T11:23:00Z",
    personas: { name: "Margaret" },
  },
  {
    id: "c-005",
    persona_id: "p-002",
    vapi_call_id: "vapi-call-005",
    inbound_number: "+16465550188",
    caller_id_name: "US Marshals",
    started_at: "2024-06-16T14:45:00Z",
    ended_at: "2024-06-16T14:53:00Z",
    duration_seconds: 480,
    status: "completed",
    scam_type: "IRS impersonation",
    intel_quality: "medium",
    extraction_raw: null,
    created_at: "2024-06-16T14:53:00Z",
    personas: { name: "Harold" },
  },
];

export const mockTranscripts: Record<string, Transcript[]> = {
  "c-001": [
    { id: 1, call_id: "c-001", turn_index: 0, speaker: "bot", text: "Hello?", timestamp: "2024-06-15T14:30:00Z" },
    { id: 2, call_id: "c-001", turn_index: 1, speaker: "scammer", text: "Hello, this is Officer Davis from the Internal Revenue Service. I'm calling about a serious matter regarding your tax account.", timestamp: "2024-06-15T14:30:05Z" },
    { id: 3, call_id: "c-001", turn_index: 2, speaker: "bot", text: "Oh my, the IRS? What's going on?", timestamp: "2024-06-15T14:30:15Z" },
    { id: 4, call_id: "c-001", turn_index: 3, speaker: "scammer", text: "Our records show that you owe $4,200 in back taxes from 2022. There is a warrant for your arrest.", timestamp: "2024-06-15T14:30:25Z" },
    { id: 5, call_id: "c-001", turn_index: 4, speaker: "bot", text: "A warrant? Oh dear, that sounds terrible. What do I need to do?", timestamp: "2024-06-15T14:30:40Z" },
    { id: 6, call_id: "c-001", turn_index: 5, speaker: "scammer", text: "You need to resolve this immediately. Purchase Google Play gift cards in the amount of $4,200.", timestamp: "2024-06-15T14:31:00Z" },
    { id: 7, call_id: "c-001", turn_index: 6, speaker: "bot", text: "Google Play gift cards? That seems unusual for the IRS...", timestamp: "2024-06-15T14:31:20Z" },
    { id: 8, call_id: "c-001", turn_index: 7, speaker: "scammer", text: "This is a special resolution program. Do not tell your family. My badge number is TX-4892. Call me back at 917-555-0147.", timestamp: "2024-06-15T14:31:40Z" },
    { id: 9, call_id: "c-001", turn_index: 8, speaker: "bot", text: "Let me write that down... TX-4892 and 917-555-0147. And where do I buy these cards?", timestamp: "2024-06-15T14:32:00Z" },
    { id: 10, call_id: "c-001", turn_index: 9, speaker: "scammer", text: "Go to CVS or Walgreens. Purchase them and call me back with the numbers on the cards. Do this within the hour or you will be arrested.", timestamp: "2024-06-15T14:32:20Z" },
  ],
  "c-002": [
    { id: 11, call_id: "c-002", turn_index: 0, speaker: "bot", text: "Hello?", timestamp: "2024-06-15T15:10:00Z" },
    { id: 12, call_id: "c-002", turn_index: 1, speaker: "scammer", text: "Hello ma'am, this is Microsoft Windows technical support. We've detected a virus on your computer.", timestamp: "2024-06-15T15:10:08Z" },
    { id: 13, call_id: "c-002", turn_index: 2, speaker: "bot", text: "A virus? On my computer? How do you know that?", timestamp: "2024-06-15T15:10:20Z" },
    { id: 14, call_id: "c-002", turn_index: 3, speaker: "scammer", text: "We monitor all Windows computers. Your license has expired and hackers are using your computer. I need you to go to anydesk.com and install the program.", timestamp: "2024-06-15T15:10:35Z" },
    { id: 15, call_id: "c-002", turn_index: 4, speaker: "bot", text: "Oh dear, hackers? Let me get my reading glasses... what was that website again?", timestamp: "2024-06-15T15:11:00Z" },
    { id: 16, call_id: "c-002", turn_index: 5, speaker: "scammer", text: "A-N-Y-D-E-S-K dot com. Install it and give me the access code.", timestamp: "2024-06-15T15:11:15Z" },
    { id: 17, call_id: "c-002", turn_index: 6, speaker: "bot", text: "I'm trying to type it but my arthritis is acting up today. Can you spell that one more time?", timestamp: "2024-06-15T15:11:40Z" },
    { id: 18, call_id: "c-002", turn_index: 7, speaker: "scammer", text: "A for apple, N for Nancy, Y for yellow, D for David, E for Edward, S for Sam, K for King. Then dot com.", timestamp: "2024-06-15T15:12:00Z" },
  ],
  "c-003": [
    { id: 19, call_id: "c-003", turn_index: 0, speaker: "bot", text: "Harold speaking.", timestamp: "2024-06-16T09:05:00Z" },
    { id: 20, call_id: "c-003", turn_index: 1, speaker: "scammer", text: "Mr. Henderson, this is Agent Williams with the Social Security Administration. Your social security number has been compromised and suspended.", timestamp: "2024-06-16T09:05:10Z" },
    { id: 21, call_id: "c-003", turn_index: 2, speaker: "bot", text: "Suspended? That doesn't sound right. Can you give me your employee ID number?", timestamp: "2024-06-16T09:05:25Z" },
    { id: 22, call_id: "c-003", turn_index: 3, speaker: "scammer", text: "Yes sir, my badge number is SSA-7731. There are 23 bank accounts opened in your name being used for drug trafficking.", timestamp: "2024-06-16T09:05:40Z" },
    { id: 23, call_id: "c-003", turn_index: 4, speaker: "bot", text: "Drug trafficking? That's absurd. I'm a retired accountant. Can you send me official documentation about this?", timestamp: "2024-06-16T09:06:00Z" },
    { id: 24, call_id: "c-003", turn_index: 5, speaker: "scammer", text: "Sir, this is an urgent matter. You need to secure your funds immediately by purchasing Target gift cards worth $5,000.", timestamp: "2024-06-16T09:06:20Z" },
    { id: 25, call_id: "c-003", turn_index: 6, speaker: "bot", text: "Gift cards to secure my funds? As a former accountant, that doesn't add up. Can I call you back at the SSA main number?", timestamp: "2024-06-16T09:06:45Z" },
    { id: 26, call_id: "c-003", turn_index: 7, speaker: "scammer", text: "No, you cannot call the main number. This is a special investigation. Call me directly at 646-555-0199.", timestamp: "2024-06-16T09:07:05Z" },
    { id: 27, call_id: "c-003", turn_index: 8, speaker: "bot", text: "I'd like to verify this. What did you say your name was again? And can you spell your last name?", timestamp: "2024-06-16T09:07:25Z" },
    { id: 28, call_id: "c-003", turn_index: 9, speaker: "scammer", text: "Agent Williams. W-I-L-L-I-A-M-S. Now sir, time is of the essence.", timestamp: "2024-06-16T09:07:40Z" },
  ],
  "c-004": [
    { id: 29, call_id: "c-004", turn_index: 0, speaker: "bot", text: "Hello?", timestamp: "2024-06-16T11:20:00Z" },
    { id: 30, call_id: "c-004", turn_index: 1, speaker: "scammer", text: "This is Amazon Prime. There is a charge of $399 on your account for an iPhone 15.", timestamp: "2024-06-16T11:20:08Z" },
    { id: 31, call_id: "c-004", turn_index: 2, speaker: "bot", text: "I don't remember ordering that. What should I do?", timestamp: "2024-06-16T11:20:20Z" },
    { id: 32, call_id: "c-004", turn_index: 3, speaker: "scammer", text: "Press 1 to cancel or hold for representative.", timestamp: "2024-06-16T11:20:30Z" },
  ],
  "c-005": [
    { id: 33, call_id: "c-005", turn_index: 0, speaker: "bot", text: "Harold speaking.", timestamp: "2024-06-16T14:45:00Z" },
    { id: 34, call_id: "c-005", turn_index: 1, speaker: "scammer", text: "This is Deputy Marshal Johnson. We have a federal warrant for your arrest due to unpaid tax obligations.", timestamp: "2024-06-16T14:45:10Z" },
    { id: 35, call_id: "c-005", turn_index: 2, speaker: "bot", text: "A federal warrant? That's very concerning. Can you give me the case number?", timestamp: "2024-06-16T14:45:25Z" },
    { id: 36, call_id: "c-005", turn_index: 3, speaker: "scammer", text: "Case number IRS-2024-88432. You owe $6,800 in back taxes. If you don't resolve this today, officers will come to your home.", timestamp: "2024-06-16T14:45:40Z" },
    { id: 37, call_id: "c-005", turn_index: 4, speaker: "bot", text: "Let me write that down... IRS-2024-88432. And you said $6,800? Let me check my records.", timestamp: "2024-06-16T14:46:00Z" },
    { id: 38, call_id: "c-005", turn_index: 5, speaker: "scammer", text: "You need to pay via Bitcoin. Go to a Bitcoin ATM and send payment to wallet address 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa.", timestamp: "2024-06-16T14:46:20Z" },
    { id: 39, call_id: "c-005", turn_index: 6, speaker: "bot", text: "Bitcoin? I'm not sure I know what that is. Can you explain how that works?", timestamp: "2024-06-16T14:46:40Z" },
    { id: 40, call_id: "c-005", turn_index: 7, speaker: "scammer", text: "You go to a Bitcoin machine at a gas station. I'll guide you through it. But first, do not discuss this with anyone.", timestamp: "2024-06-16T14:47:00Z" },
  ],
};

export const mockIntelItems: Record<string, IntelItem[]> = {
  "c-001": [
    { id: 1, call_id: "c-001", field_type: "entity_impersonated", value: "Internal Revenue Service", metadata: null, confidence: 0.95, flagged_high_value: true },
    { id: 2, call_id: "c-001", field_type: "agent_name", value: "Officer Davis", metadata: null, confidence: 0.95, flagged_high_value: false },
    { id: 3, call_id: "c-001", field_type: "badge_number", value: "TX-4892", metadata: null, confidence: 0.95, flagged_high_value: false },
    { id: 4, call_id: "c-001", field_type: "callback_number", value: "917-555-0147", metadata: null, confidence: 0.9, flagged_high_value: true },
    { id: 5, call_id: "c-001", field_type: "gift_card", value: "Google Play $4,200", metadata: { brand: "Google Play", amount: 4200 }, confidence: 0.9, flagged_high_value: true },
    { id: 6, call_id: "c-001", field_type: "quote", value: "You will be arrested today unless you cooperate", metadata: null, confidence: 0.85, flagged_high_value: false },
    { id: 7, call_id: "c-001", field_type: "quote", value: "Do not tell your family about this investigation", metadata: null, confidence: 0.85, flagged_high_value: false },
  ],
  "c-002": [
    { id: 8, call_id: "c-002", field_type: "entity_impersonated", value: "Microsoft Windows", metadata: null, confidence: 0.9, flagged_high_value: true },
    { id: 9, call_id: "c-002", field_type: "website", value: "anydesk.com", metadata: null, confidence: 0.95, flagged_high_value: true },
    { id: 10, call_id: "c-002", field_type: "quote", value: "We monitor all Windows computers", metadata: null, confidence: 0.8, flagged_high_value: false },
  ],
  "c-003": [
    { id: 11, call_id: "c-003", field_type: "entity_impersonated", value: "Social Security Administration", metadata: null, confidence: 0.95, flagged_high_value: true },
    { id: 12, call_id: "c-003", field_type: "agent_name", value: "Agent Williams", metadata: null, confidence: 0.9, flagged_high_value: false },
    { id: 13, call_id: "c-003", field_type: "badge_number", value: "SSA-7731", metadata: null, confidence: 0.9, flagged_high_value: false },
    { id: 14, call_id: "c-003", field_type: "callback_number", value: "646-555-0199", metadata: null, confidence: 0.9, flagged_high_value: true },
    { id: 15, call_id: "c-003", field_type: "gift_card", value: "Target $5,000", metadata: { brand: "Target", amount: 5000 }, confidence: 0.85, flagged_high_value: true },
    { id: 16, call_id: "c-003", field_type: "quote", value: "23 bank accounts opened in your name being used for drug trafficking", metadata: null, confidence: 0.85, flagged_high_value: false },
  ],
  "c-004": [
    { id: 17, call_id: "c-004", field_type: "entity_impersonated", value: "Amazon Prime", metadata: null, confidence: 0.8, flagged_high_value: true },
    { id: 18, call_id: "c-004", field_type: "quote", value: "There is a charge of $399 on your account for an iPhone 15", metadata: null, confidence: 0.7, flagged_high_value: false },
  ],
  "c-005": [
    { id: 19, call_id: "c-005", field_type: "entity_impersonated", value: "US Marshals Service", metadata: null, confidence: 0.9, flagged_high_value: true },
    { id: 20, call_id: "c-005", field_type: "agent_name", value: "Deputy Marshal Johnson", metadata: null, confidence: 0.9, flagged_high_value: false },
    { id: 21, call_id: "c-005", field_type: "wallet", value: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", metadata: null, confidence: 0.95, flagged_high_value: true },
    { id: 22, call_id: "c-005", field_type: "quote", value: "Do not discuss this with anyone", metadata: null, confidence: 0.85, flagged_high_value: false },
    { id: 23, call_id: "c-005", field_type: "quote", value: "Officers will come to your home", metadata: null, confidence: 0.85, flagged_high_value: false },
  ],
};
