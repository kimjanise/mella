import { createClient } from "@supabase/supabase-js";
import { generateReport } from "../services/report-generator.js";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function handleReport(callId: string): Promise<{ status: number; headers?: Record<string, string>; body: any; buffer?: Buffer }> {
  const supabase = getSupabase();

  const { data: call, error: callError } = await supabase
    .from("calls").select("*, personas(name)").eq("id", callId).single();

  if (callError || !call) {
    return { status: 404, body: { error: "Call not found" } };
  }

  const { data: transcripts } = await supabase
    .from("transcripts").select("*").eq("call_id", callId).order("turn_index", { ascending: true });

  const { data: intelItems } = await supabase
    .from("intel_items").select("*").eq("call_id", callId);

  const personaName = (call.personas as any)?.name || "Unknown Persona";
  const buffer = await generateReport(call, transcripts || [], intelItems || [], personaName);

  return {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="mella-report-${callId}.docx"`,
    },
    body: null,
    buffer,
  };
}
