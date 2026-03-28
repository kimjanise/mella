import { describe, it, expect } from "vitest";
import { generateReport } from "../src/services/report-generator";

describe("generateReport", () => {
  it("generates a valid .docx buffer with correct magic bytes", async () => {
    const call = {
      id: "test-call-001",
      inbound_number: "+15551234567",
      caller_id_name: "IRS Scammer",
      started_at: "2024-06-15T14:30:00Z",
      ended_at: "2024-06-15T14:35:00Z",
      duration_seconds: 300,
      scam_type: "IRS impersonation",
      intel_quality: "high",
    };

    const transcripts = [
      { turn_index: 0, speaker: "bot", text: "Hello?", timestamp: "2024-06-15T14:30:00Z" },
      { turn_index: 1, speaker: "scammer", text: "This is Officer Davis from the IRS.", timestamp: "2024-06-15T14:30:05Z" },
      { turn_index: 2, speaker: "bot", text: "Oh my, what's this about?", timestamp: "2024-06-15T14:30:10Z" },
      { turn_index: 3, speaker: "scammer", text: "You owe $4,200 in back taxes.", timestamp: "2024-06-15T14:30:20Z" },
      { turn_index: 4, speaker: "bot", text: "That sounds serious!", timestamp: "2024-06-15T14:30:30Z" },
    ];

    const intelItems = [
      { field_type: "agent_name", value: "Officer Davis", metadata: null, confidence: 0.95, flagged_high_value: false },
      { field_type: "gift_card", value: "Google Play $4,200", metadata: { brand: "Google Play", amount: 4200 }, confidence: 0.9, flagged_high_value: true },
      { field_type: "quote", value: "You owe $4,200 in back taxes.", metadata: null, confidence: 0.85, flagged_high_value: false },
    ];

    const buffer = await generateReport(call, transcripts, intelItems, "Margaret");

    // .docx is a ZIP file, starts with PK (0x50 0x4B)
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });
});
