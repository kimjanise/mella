import { Hono } from "hono";
import { supabase } from "../supabase.js";
import { createAssistant, updateAssistant, assignPhoneNumber } from "../services/vapi.js";

const deploy = new Hono();

deploy.post("/personas/:id/deploy", async (c) => {
  const personaId = c.req.param("id");
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!phoneNumberId) {
    return c.json({ error: "VAPI_PHONE_NUMBER_ID not configured" }, 500);
  }

  // Read persona from Supabase
  const { data: persona, error: fetchError } = await supabase
    .from("personas")
    .select("*")
    .eq("id", personaId)
    .single();

  if (fetchError || !persona) {
    return c.json({ error: "Persona not found" }, 404);
  }

  try {
    let assistantId = persona.vapi_assistant_id;

    if (!assistantId) {
      // Create new assistant
      const assistant = await createAssistant(
        persona.system_prompt,
        persona.voice_model,
        persona.name
      );
      assistantId = assistant.id;
    } else {
      // Update existing assistant
      await updateAssistant(
        assistantId,
        persona.system_prompt,
        persona.voice_model,
        persona.name
      );
    }

    // Assign phone number to this assistant
    await assignPhoneNumber(phoneNumberId, assistantId);

    // Deactivate all personas, activate this one
    await supabase.from("personas").update({ is_active: false }).neq("id", personaId);
    await supabase
      .from("personas")
      .update({
        is_active: true,
        vapi_assistant_id: assistantId,
        phone_number: phoneNumberId,
      })
      .eq("id", personaId);

    return c.json({ assistant_id: assistantId, phone_number: phoneNumberId });
  } catch (err) {
    console.error("Deploy failed:", err);
    const message = err instanceof Error ? err.message : "Deploy failed";
    return c.json({ error: message }, 500);
  }
});

export default deploy;
