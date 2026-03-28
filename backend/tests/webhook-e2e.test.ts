import { describe, it, expect } from "vitest";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BACKEND_URL = `http://localhost:${process.env.PORT || 3001}`;
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TEST_VAPI_CALL_ID = `e2e-test-${Date.now()}`;

describe("Webhook E2E", () => {
  it("processes an end-of-call webhook and persists call, transcripts, and intel", async () => {
    // Vapi end-of-call-report payload format
    const payload = {
      message: {
        type: "end-of-call-report",
        call: {
          id: TEST_VAPI_CALL_ID,
          startedAt: "2024-07-01T10:00:00Z",
          endedAt: "2024-07-01T10:05:00Z",
          customer: {
            number: "+15559876543",
          },
        },
        artifact: {
          messages: [
            { role: "assistant", message: "Hello, who is this?", secondsFromStart: 0 },
            { role: "user", message: "This is Officer Martinez from the IRS. You owe $3,500 in back taxes and a warrant has been issued for your arrest.", secondsFromStart: 5 },
            { role: "assistant", message: "Oh no, that sounds serious! What should I do?", secondsFromStart: 15 },
            { role: "user", message: "You need to purchase Apple gift cards worth $3,500 immediately. Go to Target and buy them now.", secondsFromStart: 22 },
            { role: "assistant", message: "Apple gift cards? Let me find my purse...", secondsFromStart: 30 },
            { role: "user", message: "Hurry ma'am, do not tell anyone about this. My badge number is CA-1199. Call me back at 212-555-0198.", secondsFromStart: 38 },
            { role: "assistant", message: "OK let me write that down. CA-1199 and 212-555-0198.", secondsFromStart: 48 },
          ],
        },
      },
    };

    // Send webhook
    const res = await fetch(`${BACKEND_URL}/webhooks/vapi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");

    // Wait for extraction to complete (Claude API call)
    await new Promise((r) => setTimeout(r, 15000));

    // Verify call was persisted
    const { data: call } = await supabase
      .from("calls")
      .select("*")
      .eq("vapi_call_id", TEST_VAPI_CALL_ID)
      .single();

    expect(call).toBeTruthy();
    expect(call!.inbound_number).toBe("+15559876543");
    expect(call!.status).toBe("completed");
    expect(call!.duration_seconds).toBe(300);

    // Verify extraction ran
    expect(call!.scam_type).toBeTruthy();
    expect(call!.intel_quality).toBeTruthy();
    expect(call!.extraction_raw).toBeTruthy();

    const callId = call!.id;

    // Verify transcripts
    const { data: transcripts } = await supabase
      .from("transcripts")
      .select("*")
      .eq("call_id", callId)
      .order("turn_index", { ascending: true });

    expect(transcripts).toBeTruthy();
    expect(transcripts!.length).toBe(7);
    expect(transcripts![0].speaker).toBe("bot");
    expect(transcripts![1].speaker).toBe("scammer");

    // Verify intel items
    const { data: intelItems } = await supabase
      .from("intel_items")
      .select("*")
      .eq("call_id", callId);

    expect(intelItems).toBeTruthy();
    expect(intelItems!.length).toBeGreaterThan(0);

    // Should have extracted at least an entity and a payment method
    const types = intelItems!.map((i) => i.field_type);
    expect(types).toContain("entity_impersonated");

    console.log(`\nE2E test passed! Call ID: ${callId}`);
    console.log(`  Scam type: ${call!.scam_type}`);
    console.log(`  Intel quality: ${call!.intel_quality}`);
    console.log(`  Transcripts: ${transcripts!.length} turns`);
    console.log(`  Intel items: ${intelItems!.length} items`);
    console.log(`  Field types: ${types.join(", ")}`);

    // Cleanup
    await supabase.from("intel_items").delete().eq("call_id", callId);
    await supabase.from("transcripts").delete().eq("call_id", callId);
    await supabase.from("calls").delete().eq("id", callId);
  }, 60000);
});
