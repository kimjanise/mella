import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEED_PREFIX = "seed-";
const force = process.argv.includes("--force");

async function seed() {
  // Check if already seeded
  const { data: existing } = await supabase
    .from("calls")
    .select("id")
    .like("vapi_call_id", `${SEED_PREFIX}%`)
    .limit(1);

  if (existing && existing.length > 0 && !force) {
    console.log("Seed data already exists. Use --force to re-seed.");
    return;
  }

  if (force) {
    console.log("Force mode: deleting existing seed data...");
    const { data: seedCalls } = await supabase
      .from("calls")
      .select("id")
      .like("vapi_call_id", `${SEED_PREFIX}%`);

    if (seedCalls) {
      const ids = seedCalls.map((c) => c.id);
      await supabase.from("intel_items").delete().in("call_id", ids);
      await supabase.from("transcripts").delete().in("call_id", ids);
      await supabase.from("calls").delete().in("id", ids);
    }
    await supabase.from("personas").delete().like("name", "%(seed)%");
  }

  console.log("Seeding personas...");

  const { data: personas, error: pErr } = await supabase
    .from("personas")
    .insert([
      {
        name: "Margaret (seed)",
        age: 78,
        backstory: "Retired schoolteacher from Ohio. Lives alone, hard of hearing, trusting. Often confused by technology.",
        voice_model: "EXAVITQu4vr4xnSDxMaL",
        system_prompt:
          "You are Margaret, a 78-year-old retired schoolteacher from Ohio. You are trusting, a bit hard of hearing, and easily confused by technology. You live alone and are worried about your finances. Keep every response to 2 sentences maximum.",
        target_scam_types: ["irs", "tech_support", "social_security"],
        stall_tactics: ["ask to repeat", "feign confusion", "tell stories about grandchildren"],
        is_active: true,
      },
      {
        name: "Harold (seed)",
        age: 82,
        backstory: "Retired accountant from Florida. Meticulous but slow with technology. Asks lots of detailed questions.",
        voice_model: "TX3LPaxmHKxFdv7VOQHJ",
        system_prompt:
          "You are Harold, an 82-year-old retired accountant from Florida. You are methodical, ask lots of questions, and request official documentation for everything. Keep every response to 2 sentences maximum.",
        target_scam_types: ["irs", "social_security"],
        stall_tactics: ["ask for spelling", "request documentation", "check with spouse"],
        is_active: false,
      },
    ])
    .select();

  if (pErr || !personas) {
    console.error("Failed to seed personas:", pErr);
    return;
  }
  console.log(`  Created ${personas.length} personas`);

  const margaretId = personas[0].id;
  const haroldId = personas[1].id;

  console.log("Seeding calls...");

  const calls = [
    {
      persona_id: margaretId,
      vapi_call_id: `${SEED_PREFIX}001`,
      inbound_number: "+12025550183",
      caller_id_name: "IRS Department",
      started_at: "2024-06-15T14:30:00Z",
      ended_at: "2024-06-15T14:37:00Z",
      duration_seconds: 420,
      status: "completed",
      scam_type: "IRS impersonation",
      intel_quality: "high",
    },
    {
      persona_id: margaretId,
      vapi_call_id: `${SEED_PREFIX}002`,
      inbound_number: "+19175550147",
      caller_id_name: "Windows Support",
      started_at: "2024-06-15T15:10:00Z",
      ended_at: "2024-06-15T15:18:00Z",
      duration_seconds: 480,
      status: "completed",
      scam_type: "Tech support",
      intel_quality: "medium",
    },
    {
      persona_id: haroldId,
      vapi_call_id: `${SEED_PREFIX}003`,
      inbound_number: "+13125550199",
      caller_id_name: null,
      started_at: "2024-06-16T09:05:00Z",
      ended_at: "2024-06-16T09:12:00Z",
      duration_seconds: 420,
      status: "completed",
      scam_type: "Social Security",
      intel_quality: "high",
    },
    {
      persona_id: margaretId,
      vapi_call_id: `${SEED_PREFIX}004`,
      inbound_number: "+14085550123",
      caller_id_name: "Amazon Prime",
      started_at: "2024-06-16T11:20:00Z",
      ended_at: "2024-06-16T11:23:00Z",
      duration_seconds: 180,
      status: "completed",
      scam_type: "Amazon impersonation",
      intel_quality: "low",
    },
    {
      persona_id: haroldId,
      vapi_call_id: `${SEED_PREFIX}005`,
      inbound_number: "+16465550188",
      caller_id_name: "US Marshals",
      started_at: "2024-06-16T14:45:00Z",
      ended_at: "2024-06-16T14:53:00Z",
      duration_seconds: 480,
      status: "completed",
      scam_type: "IRS impersonation",
      intel_quality: "medium",
    },
  ];

  const { data: callRows, error: cErr } = await supabase.from("calls").insert(calls).select();
  if (cErr || !callRows) {
    console.error("Failed to seed calls:", cErr);
    return;
  }
  console.log(`  Created ${callRows.length} calls`);

  const callIds = callRows.map((c) => c.id);

  console.log("Seeding transcripts...");

  const transcriptData = [
    // Call 1: IRS impersonation (Margaret)
    ...[
      { speaker: "bot", text: "Hello?" },
      { speaker: "scammer", text: "Hello, this is Officer Davis from the Internal Revenue Service. I'm calling about a serious matter regarding your tax account." },
      { speaker: "bot", text: "Oh my, the IRS? What's going on?" },
      { speaker: "scammer", text: "Our records show you owe $4,200 in back taxes from 2022. There is a warrant for your arrest issued by the federal government." },
      { speaker: "bot", text: "A warrant? Oh dear, that sounds terrible. What do I need to do?" },
      { speaker: "scammer", text: "You need to resolve this immediately or officers will be sent to your home within 45 minutes." },
      { speaker: "bot", text: "Please don't send anyone! What do I need to do to fix this?" },
      { speaker: "scammer", text: "Purchase Google Play gift cards in the amount of $4,200 from your nearest CVS or Walgreens." },
      { speaker: "bot", text: "Google Play gift cards? That seems unusual for the IRS..." },
      { speaker: "scammer", text: "This is a special resolution program. Do not tell your family. My badge number is TX-4892. Call me back at 917-555-0147." },
      { speaker: "bot", text: "Let me write that down... TX-4892 and 917-555-0147." },
      { speaker: "scammer", text: "Purchase the cards and call me back with the numbers. Do this within the hour or you will be arrested today." },
    ].map((t, i) => ({ call_id: callIds[0], turn_index: i, ...t, timestamp: new Date(Date.parse("2024-06-15T14:30:00Z") + i * 30000).toISOString() })),

    // Call 2: Tech support (Margaret)
    ...[
      { speaker: "bot", text: "Hello?" },
      { speaker: "scammer", text: "Hello ma'am, this is Microsoft Windows technical support. We've detected a virus on your computer." },
      { speaker: "bot", text: "A virus? On my computer? How do you know that?" },
      { speaker: "scammer", text: "We monitor all Windows computers. Your license has expired and hackers are using your computer. Go to anydesk.com." },
      { speaker: "bot", text: "Oh dear, hackers? Let me get my reading glasses... what was that website again?" },
      { speaker: "scammer", text: "A-N-Y-D-E-S-K dot com. Install it and give me the access code." },
      { speaker: "bot", text: "I'm trying to type it but my arthritis is acting up today. Can you spell that one more time?" },
      { speaker: "scammer", text: "A for apple, N for Nancy, Y for yellow, D for David, E for Edward, S for Sam, K for King. Then dot com." },
      { speaker: "bot", text: "Let me try again... a-n-y... what was after y?" },
      { speaker: "scammer", text: "D for David! Ma'am, we need to hurry before the hackers steal your bank information." },
    ].map((t, i) => ({ call_id: callIds[1], turn_index: i, ...t, timestamp: new Date(Date.parse("2024-06-15T15:10:00Z") + i * 30000).toISOString() })),

    // Call 3: Social Security (Harold)
    ...[
      { speaker: "bot", text: "Harold speaking." },
      { speaker: "scammer", text: "Mr. Henderson, this is Agent Williams with the Social Security Administration. Your social security number has been compromised and suspended." },
      { speaker: "bot", text: "Suspended? That doesn't sound right. Can you give me your employee ID number?" },
      { speaker: "scammer", text: "My badge number is SSA-7731. There are 23 bank accounts opened in your name being used for drug trafficking." },
      { speaker: "bot", text: "Drug trafficking? That's absurd. I'm a retired accountant. Can you send official documentation?" },
      { speaker: "scammer", text: "Sir, this is urgent. You need to secure your funds immediately by purchasing Target gift cards worth $5,000." },
      { speaker: "bot", text: "Gift cards to secure funds? As a former accountant, that doesn't add up. Can I call the SSA main number?" },
      { speaker: "scammer", text: "No, you cannot call the main number. This is a special investigation. Call me at 646-555-0199." },
      { speaker: "bot", text: "I'd like to verify this. What did you say your name was? Can you spell your last name?" },
      { speaker: "scammer", text: "Agent Williams. W-I-L-L-I-A-M-S. Sir, time is of the essence." },
      { speaker: "bot", text: "And which office are you calling from? I'd like to look up the address." },
      { speaker: "scammer", text: "We are calling from the Washington DC headquarters. Now will you cooperate or do we need to send officers?" },
    ].map((t, i) => ({ call_id: callIds[2], turn_index: i, ...t, timestamp: new Date(Date.parse("2024-06-16T09:05:00Z") + i * 25000).toISOString() })),

    // Call 4: Amazon (Margaret) - short
    ...[
      { speaker: "bot", text: "Hello?" },
      { speaker: "scammer", text: "This is Amazon Prime. There is a charge of $399 on your account for an iPhone 15. Press 1 to cancel." },
      { speaker: "bot", text: "I don't remember ordering that. What should I do?" },
      { speaker: "scammer", text: "Hold for a representative." },
    ].map((t, i) => ({ call_id: callIds[3], turn_index: i, ...t, timestamp: new Date(Date.parse("2024-06-16T11:20:00Z") + i * 20000).toISOString() })),

    // Call 5: IRS via "US Marshals" (Harold)
    ...[
      { speaker: "bot", text: "Harold speaking." },
      { speaker: "scammer", text: "This is Deputy Marshal Johnson. We have a federal warrant for your arrest due to unpaid tax obligations." },
      { speaker: "bot", text: "A federal warrant? That's very concerning. Can you give me the case number?" },
      { speaker: "scammer", text: "Case number IRS-2024-88432. You owe $6,800 in back taxes. If you don't resolve this today, officers will come to your home." },
      { speaker: "bot", text: "Let me write that down... IRS-2024-88432. And you said $6,800?" },
      { speaker: "scammer", text: "You need to pay via Bitcoin. Go to a Bitcoin ATM and send payment to wallet 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa." },
      { speaker: "bot", text: "Bitcoin? I'm not sure I know what that is. Can you explain how that works?" },
      { speaker: "scammer", text: "Go to a Bitcoin machine at a gas station. Do not discuss this with anyone." },
      { speaker: "bot", text: "Which gas station would have one of these machines? I don't drive much anymore." },
      { speaker: "scammer", text: "Any 7-Eleven or Circle K will have one. This must be done today sir." },
    ].map((t, i) => ({ call_id: callIds[4], turn_index: i, ...t, timestamp: new Date(Date.parse("2024-06-16T14:45:00Z") + i * 30000).toISOString() })),
  ];

  const { error: tErr } = await supabase.from("transcripts").insert(transcriptData);
  if (tErr) {
    console.error("Failed to seed transcripts:", tErr);
    return;
  }
  console.log(`  Created ${transcriptData.length} transcript turns`);

  console.log("Seeding intel items...");

  const intelData = [
    // Call 1
    { call_id: callIds[0], field_type: "entity_impersonated", value: "Internal Revenue Service", metadata: null, confidence: 0.95, flagged_high_value: true },
    { call_id: callIds[0], field_type: "agent_name", value: "Officer Davis", metadata: null, confidence: 0.95, flagged_high_value: false },
    { call_id: callIds[0], field_type: "badge_number", value: "TX-4892", metadata: null, confidence: 0.95, flagged_high_value: false },
    { call_id: callIds[0], field_type: "callback_number", value: "917-555-0147", metadata: null, confidence: 0.9, flagged_high_value: true },
    { call_id: callIds[0], field_type: "gift_card", value: "Google Play $4,200", metadata: { brand: "Google Play", amount: 4200 }, confidence: 0.9, flagged_high_value: true },
    { call_id: callIds[0], field_type: "quote", value: "You will be arrested today unless you cooperate", metadata: null, confidence: 0.85, flagged_high_value: false },
    { call_id: callIds[0], field_type: "quote", value: "Do not tell your family about this investigation", metadata: null, confidence: 0.85, flagged_high_value: false },

    // Call 2
    { call_id: callIds[1], field_type: "entity_impersonated", value: "Microsoft Windows", metadata: null, confidence: 0.9, flagged_high_value: true },
    { call_id: callIds[1], field_type: "website", value: "anydesk.com", metadata: null, confidence: 0.95, flagged_high_value: true },
    { call_id: callIds[1], field_type: "quote", value: "We monitor all Windows computers", metadata: null, confidence: 0.8, flagged_high_value: false },
    { call_id: callIds[1], field_type: "quote", value: "Hackers are stealing your bank information", metadata: null, confidence: 0.8, flagged_high_value: false },

    // Call 3
    { call_id: callIds[2], field_type: "entity_impersonated", value: "Social Security Administration", metadata: null, confidence: 0.95, flagged_high_value: true },
    { call_id: callIds[2], field_type: "agent_name", value: "Agent Williams", metadata: null, confidence: 0.9, flagged_high_value: false },
    { call_id: callIds[2], field_type: "badge_number", value: "SSA-7731", metadata: null, confidence: 0.9, flagged_high_value: false },
    { call_id: callIds[2], field_type: "callback_number", value: "646-555-0199", metadata: null, confidence: 0.9, flagged_high_value: true },
    { call_id: callIds[2], field_type: "gift_card", value: "Target $5,000", metadata: { brand: "Target", amount: 5000 }, confidence: 0.85, flagged_high_value: true },
    { call_id: callIds[2], field_type: "quote", value: "23 bank accounts opened in your name for drug trafficking", metadata: null, confidence: 0.85, flagged_high_value: false },
    { call_id: callIds[2], field_type: "quote", value: "Do we need to send officers?", metadata: null, confidence: 0.8, flagged_high_value: false },

    // Call 4
    { call_id: callIds[3], field_type: "entity_impersonated", value: "Amazon Prime", metadata: null, confidence: 0.8, flagged_high_value: true },
    { call_id: callIds[3], field_type: "quote", value: "Charge of $399 for an iPhone 15", metadata: null, confidence: 0.7, flagged_high_value: false },

    // Call 5
    { call_id: callIds[4], field_type: "entity_impersonated", value: "US Marshals Service", metadata: null, confidence: 0.9, flagged_high_value: true },
    { call_id: callIds[4], field_type: "agent_name", value: "Deputy Marshal Johnson", metadata: null, confidence: 0.9, flagged_high_value: false },
    { call_id: callIds[4], field_type: "wallet", value: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", metadata: null, confidence: 0.95, flagged_high_value: true },
    { call_id: callIds[4], field_type: "quote", value: "Do not discuss this with anyone", metadata: null, confidence: 0.85, flagged_high_value: false },
    { call_id: callIds[4], field_type: "quote", value: "Officers will come to your home", metadata: null, confidence: 0.85, flagged_high_value: false },
  ];

  const { error: iErr } = await supabase.from("intel_items").insert(intelData);
  if (iErr) {
    console.error("Failed to seed intel items:", iErr);
    return;
  }
  console.log(`  Created ${intelData.length} intel items`);

  console.log("Seed complete!");
}

seed().catch(console.error);
