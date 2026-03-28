import { createClient } from "@supabase/supabase-js";
import { createAssistant, updateAssistant, assignPhoneNumber } from "../services/vapi.js";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function handleDeploy(personaId: string): Promise<{ status: number; body: any }> {
  const supabase = getSupabase();
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!phoneNumberId) {
    return { status: 500, body: { error: "VAPI_PHONE_NUMBER_ID not configured" } };
  }

  const { data: persona, error: fetchError } = await supabase
    .from("personas").select("*").eq("id", personaId).single();

  if (fetchError || !persona) {
    return { status: 404, body: { error: "Persona not found" } };
  }

  try {
    let assistantId = persona.vapi_assistant_id;

    if (!assistantId) {
      const assistant = await createAssistant(persona.system_prompt, persona.voice_model, persona.name);
      assistantId = assistant.id;
    } else {
      await updateAssistant(assistantId, persona.system_prompt, persona.voice_model, persona.name);
    }

    await assignPhoneNumber(phoneNumberId, assistantId);
    await supabase.from("personas").update({ is_active: false }).neq("id", personaId);
    await supabase.from("personas").update({ is_active: true, vapi_assistant_id: assistantId, phone_number: phoneNumberId }).eq("id", personaId);

    return { status: 200, body: { assistant_id: assistantId, phone_number: phoneNumberId } };
  } catch (err) {
    console.error("Deploy failed:", err);
    const message = err instanceof Error ? err.message : "Deploy failed";
    return { status: 500, body: { error: message } };
  }
}
