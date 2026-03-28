import { Hono } from "hono";
import { supabase } from "../supabase.js";
import { extractIntel, ExtractionResult } from "../services/extraction.js";

const webhooks = new Hono();

interface VapiTranscriptEntry {
  role: string;
  message: string;
  time?: number;
  secondsFromStart?: number;
}

interface VapiWebhookPayload {
  message: {
    type: string;
    call?: {
      id?: string;
      startedAt?: string;
      endedAt?: string;
      customer?: {
        number?: string;
      };
      phoneNumber?: {
        assistantId?: string;
      };
    };
    transcript?: string;
    artifact?: {
      messages?: VapiTranscriptEntry[];
      transcript?: string;
    };
    [key: string]: unknown;
  };
}

function mapSpeaker(role: string): "bot" | "scammer" {
  if (role === "assistant" || role === "bot") return "bot";
  return "scammer";
}

function parseTranscriptEntries(payload: VapiWebhookPayload): VapiTranscriptEntry[] {
  // Vapi sends transcript messages in artifact.messages
  if (payload.message.artifact?.messages) {
    return payload.message.artifact.messages;
  }
  // Fallback: check for top-level transcript array (older format)
  if (Array.isArray((payload.message as any).transcript)) {
    return (payload.message as any).transcript;
  }
  return [];
}

function buildTranscriptText(entries: VapiTranscriptEntry[]): string {
  return entries
    .map((e) => `${mapSpeaker(e.role) === "bot" ? "Bot" : "Scammer"}: ${e.message}`)
    .join("\n");
}

function extractIntelItems(result: ExtractionResult, callId: string) {
  const items: {
    call_id: string;
    field_type: string;
    value: string;
    metadata: Record<string, unknown> | null;
    confidence: number | null;
    flagged_high_value: boolean;
  }[] = [];

  const conf = result.confidence;

  if (result.entity_impersonated) {
    items.push({
      call_id: callId,
      field_type: "entity_impersonated",
      value: result.entity_impersonated,
      metadata: null,
      confidence: conf,
      flagged_high_value: true,
    });
  }

  if (result.agent_name) {
    items.push({
      call_id: callId,
      field_type: "agent_name",
      value: result.agent_name,
      metadata: null,
      confidence: conf,
      flagged_high_value: false,
    });
  }

  if (result.badge_number) {
    items.push({
      call_id: callId,
      field_type: "badge_number",
      value: result.badge_number,
      metadata: null,
      confidence: conf,
      flagged_high_value: false,
    });
  }

  if (result.inbound_number) {
    items.push({
      call_id: callId,
      field_type: "phone",
      value: result.inbound_number,
      metadata: null,
      confidence: conf,
      flagged_high_value: true,
    });
  }

  if (result.callback_number) {
    items.push({
      call_id: callId,
      field_type: "callback_number",
      value: result.callback_number,
      metadata: null,
      confidence: conf,
      flagged_high_value: true,
    });
  }

  for (const pm of result.payment_methods) {
    items.push({
      call_id: callId,
      field_type: "gift_card",
      value: `${pm.brand || pm.type}${pm.amount_requested ? ` $${pm.amount_requested}` : ""}`,
      metadata: pm as unknown as Record<string, unknown>,
      confidence: conf,
      flagged_high_value: true,
    });
  }

  for (const wallet of result.crypto_wallets) {
    items.push({
      call_id: callId,
      field_type: "wallet",
      value: wallet,
      metadata: null,
      confidence: conf,
      flagged_high_value: true,
    });
  }

  for (const bank of result.bank_details) {
    items.push({
      call_id: callId,
      field_type: "bank",
      value: bank,
      metadata: null,
      confidence: conf,
      flagged_high_value: true,
    });
  }

  for (const email of result.email_addresses) {
    items.push({
      call_id: callId,
      field_type: "email",
      value: email,
      metadata: null,
      confidence: conf,
      flagged_high_value: false,
    });
  }

  for (const website of result.websites_mentioned) {
    items.push({
      call_id: callId,
      field_type: "website",
      value: website,
      metadata: null,
      confidence: conf,
      flagged_high_value: false,
    });
  }

  for (const quote of result.key_quotes) {
    items.push({
      call_id: callId,
      field_type: "quote",
      value: quote,
      metadata: null,
      confidence: conf,
      flagged_high_value: false,
    });
  }

  return items;
}

webhooks.post("/webhooks/vapi", async (c) => {
  let payload: VapiWebhookPayload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Only process end-of-call reports
  if (payload.message?.type !== "end-of-call-report") {
    return c.json({ status: "ignored", reason: `type=${payload.message?.type}` });
  }

  const call = payload.message.call;
  const vapiCallId = call?.id || `unknown-${Date.now()}`;
  const startedAt = call?.startedAt || null;
  const endedAt = call?.endedAt || null;
  const inboundNumber = call?.customer?.number || null;

  let durationSeconds: number | null = null;
  if (startedAt && endedAt) {
    durationSeconds = Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
    );
  }

  // Find persona by assistant ID
  let personaId: string | null = null;
  const assistantId = call?.phoneNumber?.assistantId;
  if (assistantId) {
    const { data: persona } = await supabase
      .from("personas")
      .select("id")
      .eq("vapi_assistant_id", assistantId)
      .single();
    if (persona) personaId = persona.id;
  }

  // 1. Insert call record
  const { data: callRow, error: callError } = await supabase
    .from("calls")
    .insert({
      vapi_call_id: vapiCallId,
      persona_id: personaId,
      inbound_number: inboundNumber,
      caller_id_name: null,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      status: "completed",
    })
    .select("id")
    .single();

  if (callError || !callRow) {
    console.error("Failed to insert call:", callError);
    return c.json({ status: "ok" });
  }

  const callId = callRow.id;

  // 2. Insert transcript rows
  const entries = parseTranscriptEntries(payload);
  if (entries.length > 0) {
    const transcriptRows = entries.map((entry, i) => ({
      call_id: callId,
      turn_index: i,
      speaker: mapSpeaker(entry.role),
      text: entry.message,
      timestamp: entry.secondsFromStart && startedAt
        ? new Date(new Date(startedAt).getTime() + entry.secondsFromStart * 1000).toISOString()
        : startedAt,
    }));

    const { error: transcriptError } = await supabase.from("transcripts").insert(transcriptRows);
    if (transcriptError) {
      console.error("Failed to insert transcripts:", transcriptError);
    }
  }

  // 3. Run extraction (don't fail the webhook if this fails)
  try {
    const transcriptText = entries.length > 0
      ? buildTranscriptText(entries)
      : payload.message.artifact?.transcript || payload.message.transcript || "";

    if (transcriptText) {
      const result = await extractIntel(transcriptText as string);

      // 4. Insert intel items
      const intelItems = extractIntelItems(result, callId);
      if (intelItems.length > 0) {
        const { error: intelError } = await supabase.from("intel_items").insert(intelItems);
        if (intelError) console.error("Failed to insert intel items:", intelError);
      }

      // 5. Update call with extraction results
      await supabase
        .from("calls")
        .update({
          scam_type: result.scam_type,
          intel_quality: result.intel_quality,
          extraction_raw: result,
        })
        .eq("id", callId);
    }
  } catch (err) {
    console.error("Extraction failed, call and transcript still persisted:", err);
  }

  return c.json({ status: "ok" });
});

export default webhooks;
