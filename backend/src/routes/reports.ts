import { Hono } from "hono";
import { supabase } from "../supabase.js";
import { generateReport } from "../services/report-generator.js";

const reports = new Hono();

reports.get("/calls/:id/report", async (c) => {
  const callId = c.req.param("id");

  // Fetch call with persona name
  const { data: call, error: callError } = await supabase
    .from("calls")
    .select("*, personas(name)")
    .eq("id", callId)
    .single();

  if (callError || !call) {
    return c.json({ error: "Call not found" }, 404);
  }

  // Fetch transcripts
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("*")
    .eq("call_id", callId)
    .order("turn_index", { ascending: true });

  // Fetch intel items
  const { data: intelItems } = await supabase
    .from("intel_items")
    .select("*")
    .eq("call_id", callId);

  const personaName = (call.personas as any)?.name || "Unknown Persona";

  const buffer = await generateReport(
    call,
    transcripts || [],
    intelItems || [],
    personaName
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="mella-report-${callId}.docx"`,
    },
  });
});

export default reports;
