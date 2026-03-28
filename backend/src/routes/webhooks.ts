import { createClient } from "@supabase/supabase-js";
import { extractIntel } from "../services/extraction.js";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function mapSpeaker(role: string): "bot" | "scammer" {
  return role === "assistant" || role === "bot" || role === "system" ? "bot" : "scammer";
}

function isSystemMessage(entry: any): boolean {
  return entry.role === "system" || (entry.role === "bot" && entry.message?.includes("Keep every response to 2 sentences"));
}

export async function handleWebhook(payload: any): Promise<{ status: number; body: any }> {
  const supabase = getSupabase();

  if (payload?.message?.type !== "end-of-call-report") {
    return { status: 200, body: { status: "ignored" } };
  }

  const msg = payload.message;
  const call = msg.call || {};

  // Extract call ID
  const vapiCallId = call.id || `unknown-${Date.now()}`;

  // Try multiple paths for timestamps (Vapi format varies)
  const startedAt = call.startedAt || call.started_at || call.createdAt || msg.startedAt || null;
  const endedAt = call.endedAt || call.ended_at || msg.endedAt || null;
  let durationSeconds: number | null = null;
  if (startedAt && endedAt) {
    durationSeconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  }
  // Also try direct duration field
  if (!durationSeconds && (call.duration || msg.duration)) {
    durationSeconds = Math.round(call.duration || msg.duration);
  }

  // Try multiple paths for phone number
  const inboundNumber = call.customer?.number || call.phoneNumber?.number || msg.phoneNumber?.number || null;

  // Try multiple paths for assistant ID to find persona
  const assistantId = call.assistantId || call.assistant?.id || call.phoneNumber?.assistantId || msg.assistantId || null;
  let personaId: string | null = null;
  if (assistantId) {
    const { data: persona } = await supabase
      .from("personas").select("id").eq("vapi_assistant_id", assistantId).single();
    if (persona) personaId = persona.id;
  }
  // Fallback: use the currently active persona
  if (!personaId) {
    const { data: activePers } = await supabase
      .from("personas").select("id").eq("is_active", true).single();
    if (activePers) personaId = activePers.id;
  }

  const { data: callRow, error: callError } = await supabase
    .from("calls")
    .insert({
      vapi_call_id: vapiCallId, persona_id: personaId, inbound_number: inboundNumber,
      started_at: startedAt, ended_at: endedAt, duration_seconds: durationSeconds, status: "completed",
    })
    .select("id").single();

  if (callError || !callRow) {
    console.error("Failed to insert call:", callError);
    return { status: 200, body: { status: "ok" } };
  }

  const callId = callRow.id;

  // Get transcript entries — filter out system messages
  const entries = (msg.artifact?.messages || []).filter((e: any) => !isSystemMessage(e));

  if (entries.length > 0) {
    const rows = entries.map((e: any, i: number) => ({
      call_id: callId, turn_index: i, speaker: mapSpeaker(e.role), text: e.message || e.content || "",
      timestamp: e.secondsFromStart && startedAt
        ? new Date(new Date(startedAt).getTime() + e.secondsFromStart * 1000).toISOString()
        : startedAt,
    }));
    await supabase.from("transcripts").insert(rows);
  }

  try {
    const text = entries
      .map((e: any) => `${mapSpeaker(e.role) === "bot" ? "Bot" : "Scammer"}: ${e.message || e.content || ""}`)
      .join("\n");

    if (text) {
      const result = await extractIntel(text);
      const items: any[] = [];
      const conf = result.confidence;

      if (result.entity_impersonated) items.push({ call_id: callId, field_type: "entity_impersonated", value: result.entity_impersonated, metadata: null, confidence: conf, flagged_high_value: true });
      if (result.agent_name) items.push({ call_id: callId, field_type: "agent_name", value: result.agent_name, metadata: null, confidence: conf, flagged_high_value: false });
      if (result.badge_number) items.push({ call_id: callId, field_type: "badge_number", value: result.badge_number, metadata: null, confidence: conf, flagged_high_value: false });
      if (result.callback_number) items.push({ call_id: callId, field_type: "callback_number", value: result.callback_number, metadata: null, confidence: conf, flagged_high_value: true });
      for (const pm of result.payment_methods) items.push({ call_id: callId, field_type: "gift_card", value: `${pm.brand || pm.type}${pm.amount_requested ? ` $${pm.amount_requested}` : ""}`, metadata: pm as any, confidence: conf, flagged_high_value: true });
      for (const w of result.crypto_wallets) items.push({ call_id: callId, field_type: "wallet", value: w, metadata: null, confidence: conf, flagged_high_value: true });
      for (const b of result.bank_details) items.push({ call_id: callId, field_type: "bank", value: b, metadata: null, confidence: conf, flagged_high_value: true });
      for (const e of result.email_addresses) items.push({ call_id: callId, field_type: "email", value: e, metadata: null, confidence: conf, flagged_high_value: false });
      for (const w of result.websites_mentioned) items.push({ call_id: callId, field_type: "website", value: w, metadata: null, confidence: conf, flagged_high_value: true });
      for (const q of result.key_quotes) items.push({ call_id: callId, field_type: "quote", value: q, metadata: null, confidence: conf, flagged_high_value: false });

      if (items.length > 0) await supabase.from("intel_items").insert(items);
      await supabase.from("calls").update({ scam_type: result.scam_type, intel_quality: result.intel_quality, extraction_raw: result }).eq("id", callId);
    }
  } catch (err) {
    console.error("Extraction failed:", err);
  }

  return { status: 200, body: { status: "ok" } };
}
