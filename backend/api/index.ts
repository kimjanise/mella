import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 60 };

const getSupabase = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function corsHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const path = req.url?.replace(/\?.*$/, "") || "";

  // Health
  if (path === "/api/health") {
    return res.json({ status: "ok" });
  }

  // Webhook
  if (path === "/api/webhooks/vapi" && req.method === "POST") {
    return handleWebhook(req, res);
  }

  // Deploy
  const deployMatch = path.match(/^\/api\/personas\/([^/]+)\/deploy$/);
  if (deployMatch && req.method === "POST") {
    return handleDeploy(deployMatch[1], res);
  }

  // Report
  const reportMatch = path.match(/^\/api\/calls\/([^/]+)\/report$/);
  if (reportMatch && req.method === "GET") {
    return handleReport(reportMatch[1], res);
  }

  return res.status(404).json({ error: "Not found" });
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase();
  const payload = req.body;
  if (payload?.message?.type !== "end-of-call-report") return res.json({ status: "ignored" });

  const call = payload.message.call;
  const vapiCallId = call?.id || `unknown-${Date.now()}`;
  const startedAt = call?.startedAt || null;
  const endedAt = call?.endedAt || null;
  const inboundNumber = call?.customer?.number || null;
  let durationSeconds: number | null = null;
  if (startedAt && endedAt) durationSeconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);

  let personaId: string | null = null;
  const assistantId = call?.phoneNumber?.assistantId;
  if (assistantId) {
    const { data: persona } = await supabase.from("personas").select("id").eq("vapi_assistant_id", assistantId).single();
    if (persona) personaId = persona.id;
  }

  const { data: callRow, error: callError } = await supabase.from("calls").insert({
    vapi_call_id: vapiCallId, persona_id: personaId, inbound_number: inboundNumber,
    started_at: startedAt, ended_at: endedAt, duration_seconds: durationSeconds, status: "completed",
  }).select("id").single();

  if (callError || !callRow) { console.error("Insert call failed:", callError); return res.json({ status: "ok" }); }
  const callId = callRow.id;

  const entries = payload.message.artifact?.messages || [];
  if (entries.length > 0) {
    const rows = entries.map((e: any, i: number) => ({
      call_id: callId, turn_index: i,
      speaker: (e.role === "assistant" || e.role === "bot") ? "bot" : "scammer",
      text: e.message,
      timestamp: e.secondsFromStart && startedAt ? new Date(new Date(startedAt).getTime() + e.secondsFromStart * 1000).toISOString() : startedAt,
    }));
    await supabase.from("transcripts").insert(rows);
  }

  try {
    const text = entries.map((e: any) => `${e.role === "assistant" ? "Bot" : "Scammer"}: ${e.message}`).join("\n");
    if (text) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic();
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514", max_tokens: 2048,
        tools: [{
          name: "extract_intel", description: "Extract structured intelligence from a scam call transcript.",
          input_schema: {
            type: "object" as const,
            properties: {
              scam_type: { type: "string" }, entity_impersonated: { type: "string" }, agent_name: { type: "string" },
              badge_number: { type: "string" }, callback_number: { type: "string" },
              payment_methods: { type: "array", items: { type: "object", properties: { type: { type: "string" }, brand: { type: "string" }, amount_requested: { type: "number" } }, required: ["type"] } },
              crypto_wallets: { type: "array", items: { type: "string" } }, email_addresses: { type: "array", items: { type: "string" } },
              websites_mentioned: { type: "array", items: { type: "string" } },
              intel_quality: { type: "string", enum: ["high", "medium", "low"] }, confidence: { type: "number" },
              key_quotes: { type: "array", items: { type: "string" } },
            },
            required: ["scam_type", "intel_quality", "confidence", "key_quotes", "payment_methods"],
          },
        }],
        tool_choice: { type: "tool", name: "extract_intel" },
        messages: [{ role: "user", content: `Analyze this scam call transcript and extract all intelligence.\n\nTRANSCRIPT:\n${text}` }],
      });
      const toolBlock = response.content.find((b: any) => b.type === "tool_use");
      if (toolBlock && toolBlock.type === "tool_use") {
        const r = toolBlock.input as any;
        const items: any[] = [];
        const conf = r.confidence || 0.5;
        if (r.entity_impersonated) items.push({ call_id: callId, field_type: "entity_impersonated", value: r.entity_impersonated, metadata: null, confidence: conf, flagged_high_value: true });
        if (r.agent_name) items.push({ call_id: callId, field_type: "agent_name", value: r.agent_name, metadata: null, confidence: conf, flagged_high_value: false });
        if (r.badge_number) items.push({ call_id: callId, field_type: "badge_number", value: r.badge_number, metadata: null, confidence: conf, flagged_high_value: false });
        if (r.callback_number) items.push({ call_id: callId, field_type: "callback_number", value: r.callback_number, metadata: null, confidence: conf, flagged_high_value: true });
        for (const pm of r.payment_methods || []) items.push({ call_id: callId, field_type: "gift_card", value: `${pm.brand || pm.type}${pm.amount_requested ? ` $${pm.amount_requested}` : ""}`, metadata: pm, confidence: conf, flagged_high_value: true });
        for (const w of r.crypto_wallets || []) items.push({ call_id: callId, field_type: "wallet", value: w, metadata: null, confidence: conf, flagged_high_value: true });
        for (const e of r.email_addresses || []) items.push({ call_id: callId, field_type: "email", value: e, metadata: null, confidence: conf, flagged_high_value: false });
        for (const w of r.websites_mentioned || []) items.push({ call_id: callId, field_type: "website", value: w, metadata: null, confidence: conf, flagged_high_value: true });
        for (const q of r.key_quotes || []) items.push({ call_id: callId, field_type: "quote", value: q, metadata: null, confidence: conf, flagged_high_value: false });
        if (items.length > 0) await supabase.from("intel_items").insert(items);
        await supabase.from("calls").update({ scam_type: r.scam_type, intel_quality: r.intel_quality, extraction_raw: r }).eq("id", callId);
      }
    }
  } catch (err) { console.error("Extraction failed:", err); }

  return res.json({ status: "ok" });
}

async function handleDeploy(personaId: string, res: VercelResponse) {
  const supabase = getSupabase();
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!phoneNumberId) return res.status(500).json({ error: "VAPI_PHONE_NUMBER_ID not set" });

  const { data: persona, error } = await supabase.from("personas").select("*").eq("id", personaId).single();
  if (error || !persona) return res.status(404).json({ error: "Persona not found" });

  try {
    const vapiReq = async (method: string, path: string, body?: unknown) => {
      const r = await fetch(`https://api.vapi.ai${path}`, {
        method, headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!r.ok) throw new Error(`Vapi ${method} ${path}: ${r.status}`);
      return r.json();
    };

    let aId = persona.vapi_assistant_id;
    const cfg = {
      model: { provider: "anthropic", model: "claude-sonnet-4-20250514", messages: [{ role: "system", content: `${persona.system_prompt}\n\nIMPORTANT: Keep every response to 2 sentences maximum.` }] },
      voice: { provider: "11labs", voiceId: persona.voice_model },
    };
    if (!aId) { const r = await vapiReq("POST", "/assistant", { name: persona.name, ...cfg, firstMessage: "Hello?" }) as any; aId = r.id; }
    else { await vapiReq("PATCH", `/assistant/${aId}`, cfg); }
    await vapiReq("PATCH", `/phone-number/${phoneNumberId}`, { assistantId: aId });
    await supabase.from("personas").update({ is_active: false }).neq("id", personaId);
    await supabase.from("personas").update({ is_active: true, vapi_assistant_id: aId, phone_number: phoneNumberId }).eq("id", personaId);
    return res.json({ assistant_id: aId, phone_number: phoneNumberId });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
}

async function handleReport(callId: string, res: VercelResponse) {
  const supabase = getSupabase();
  const { data: call, error } = await supabase.from("calls").select("*, personas(name)").eq("id", callId).single();
  if (error || !call) return res.status(404).json({ error: "Call not found" });
  const { data: transcripts } = await supabase.from("transcripts").select("*").eq("call_id", callId).order("turn_index", { ascending: true });
  const { data: intelItems } = await supabase.from("intel_items").select("*").eq("call_id", callId);

  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = await import("docx");
  const personaName = (call.personas as any)?.name || "Unknown";
  const border = { style: BorderStyle.SINGLE, size: 1, color: "cccccc" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const sections: any[] = [];
  sections.push(
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mella Intelligence Report", bold: true, size: 36 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 20, color: "666666" })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Call Summary" })] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [["Persona", personaName], ["Inbound", call.inbound_number || "Unknown"], ["Scam Type", call.scam_type || "N/A"], ["Quality", call.intel_quality || "N/A"]].map(([l, v]) => new TableRow({ children: [new TableCell({ borders, children: [new Paragraph({ children: [new TextRun({ text: l, bold: true, size: 20 })] })] }), new TableCell({ borders, children: [new Paragraph({ children: [new TextRun({ text: v, size: 20 })] })] })] })) }) as any,
  );

  for (const i of (intelItems || []).filter((i: any) => i.field_type !== "quote"))
    sections.push(new Paragraph({ children: [new TextRun({ text: `${i.field_type}: `, bold: true, size: 20 }), new TextRun({ text: i.value, size: 20 })] }));

  const quotes = (intelItems || []).filter((i: any) => i.field_type === "quote");
  if (quotes.length) {
    sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400 }, children: [new TextRun({ text: "Key Quotes" })] }));
    for (const q of quotes) sections.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `"${q.value}"`, italics: true, size: 20 })] }));
  }

  sections.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400 }, children: [new TextRun({ text: "Transcript" })] }));
  for (const t of transcripts || []) sections.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `[${t.speaker === "bot" ? "Bot" : "Scammer"}] `, bold: true, size: 20 }), new TextRun({ text: t.text, size: 20 })] }));

  const doc = new Document({ sections: [{ children: sections }] });
  const buffer = await Packer.toBuffer(doc);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="mella-report-${callId}.docx"`);
  return res.send(Buffer.from(buffer));
}
