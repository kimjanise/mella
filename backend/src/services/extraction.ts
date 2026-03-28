import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface ExtractionResult {
  scam_type: string | null;
  entity_impersonated: string | null;
  agent_name: string | null;
  badge_number: string | null;
  inbound_number: string | null;
  callback_number: string | null;
  payment_methods: { type: string; brand: string; amount_requested: number | null }[];
  crypto_wallets: string[];
  bank_details: string[];
  email_addresses: string[];
  websites_mentioned: string[];
  script_stages: string[];
  bot_detection_attempts: boolean;
  intel_quality: "high" | "medium" | "low" | null;
  confidence: number;
  key_quotes: string[];
}

const EXTRACT_INTEL_TOOL: Anthropic.Tool = {
  name: "extract_intel",
  description:
    "Extract structured intelligence from a scam call transcript. Identify all phone numbers, payment methods, crypto wallets, impersonated entities, and key quotes.",
  input_schema: {
    type: "object" as const,
    properties: {
      scam_type: {
        type: "string",
        description:
          "The type of scam (e.g. IRS impersonation, tech support, Social Security, romance, etc.)",
      },
      entity_impersonated: {
        type: "string",
        description: "The organization or entity being impersonated, if any",
      },
      agent_name: {
        type: "string",
        description: "The name the scammer used for themselves",
      },
      badge_number: {
        type: "string",
        description: "Any badge or ID number the scammer provided",
      },
      inbound_number: {
        type: "string",
        description: "The phone number the call came from",
      },
      callback_number: {
        type: "string",
        description: "Any callback number the scammer provided",
      },
      payment_methods: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", description: "Payment type (gift_card, wire_transfer, crypto, etc.)" },
            brand: { type: "string", description: "Brand if gift card (Google Play, iTunes, etc.)" },
            amount_requested: { type: "number", description: "Amount requested in dollars" },
          },
          required: ["type"],
        },
        description: "All payment methods mentioned",
      },
      crypto_wallets: {
        type: "array",
        items: { type: "string" },
        description: "Any cryptocurrency wallet addresses mentioned",
      },
      bank_details: {
        type: "array",
        items: { type: "string" },
        description: "Any bank account details or routing numbers mentioned",
      },
      email_addresses: {
        type: "array",
        items: { type: "string" },
        description: "Any email addresses mentioned",
      },
      websites_mentioned: {
        type: "array",
        items: { type: "string" },
        description: "Any websites or URLs mentioned",
      },
      script_stages: {
        type: "array",
        items: { type: "string" },
        description:
          "The stages of the scam script observed (e.g. hook, fear_escalation, payment_instruction, isolation)",
      },
      bot_detection_attempts: {
        type: "boolean",
        description: "Whether the scammer attempted to detect if they were talking to a bot",
      },
      intel_quality: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "Overall quality of intel extracted: high = multiple actionable fields, medium = some useful data, low = minimal or no actionable data",
      },
      confidence: {
        type: "number",
        description: "Confidence score from 0 to 1 for the extraction accuracy",
      },
      key_quotes: {
        type: "array",
        items: { type: "string" },
        description:
          "Verbatim quotes from the scammer that are notable — threats, payment instructions, isolation tactics, impersonation claims",
      },
    },
    required: [
      "scam_type",
      "payment_methods",
      "crypto_wallets",
      "bank_details",
      "email_addresses",
      "websites_mentioned",
      "script_stages",
      "bot_detection_attempts",
      "intel_quality",
      "confidence",
      "key_quotes",
    ],
  },
};

const FALLBACK_RESULT: ExtractionResult = {
  scam_type: null,
  entity_impersonated: null,
  agent_name: null,
  badge_number: null,
  inbound_number: null,
  callback_number: null,
  payment_methods: [],
  crypto_wallets: [],
  bank_details: [],
  email_addresses: [],
  websites_mentioned: [],
  script_stages: [],
  bot_detection_attempts: false,
  intel_quality: null,
  confidence: 0,
  key_quotes: [],
};

export async function extractIntel(transcript: string): Promise<ExtractionResult> {
  // Handle very short transcripts
  const turnCount = transcript.split("\n").filter((line) => line.trim().length > 0).length;

  if (turnCount < 2) {
    return { ...FALLBACK_RESULT, intel_quality: "low", confidence: 0.1 };
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      tools: [EXTRACT_INTEL_TOOL],
      tool_choice: { type: "tool", name: "extract_intel" },
      messages: [
        {
          role: "user",
          content: `Analyze the following scam call transcript and extract all intelligence. The transcript is between a scam-baiting bot and a scammer. Identify every piece of actionable information.

TRANSCRIPT:
${transcript}`,
        },
      ],
    });

    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolUseBlock) {
      return FALLBACK_RESULT;
    }

    const result = toolUseBlock.input as ExtractionResult;

    // Override quality for very short transcripts
    if (turnCount <= 3) {
      result.intel_quality = "low";
      result.confidence = Math.min(result.confidence, 0.4);
    }

    return result;
  } catch (error) {
    console.error("Extraction failed:", error);
    return FALLBACK_RESULT;
  }
}
