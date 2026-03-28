import { describe, it, expect } from "vitest";
import "dotenv/config";
import { extractIntel } from "../src/services/extraction";

describe("extractIntel", () => {
  it("extracts structured intel from a realistic IRS scam transcript", async () => {
    const transcript = `Bot: Hello?
Scammer: Hello, this is Officer Davis from the Internal Revenue Service. I'm calling about a serious matter regarding your tax account.
Bot: Oh my, the IRS? What's going on?
Scammer: Ma'am, our records show that you owe $4,200 in back taxes from 2022. There is a warrant for your arrest that has been issued by the federal government.
Bot: A warrant? Oh dear, that sounds terrible. What do I need to do?
Scammer: You need to resolve this immediately or officers will be sent to your home within the next 45 minutes. Do you understand the severity of this situation?
Bot: Yes, yes I understand. Please don't send anyone. What do I need to do to fix this?
Scammer: You need to purchase Google Play gift cards in the amount of $4,200. Go to your nearest CVS or Walgreens and purchase them.
Bot: Google Play gift cards? That seems unusual for the IRS...
Scammer: This is a special resolution program. Do not tell your family or anyone about this investigation. Do not contact your local police department. My badge number is TX-4892 and you can call me back at 917-555-0147.
Bot: Okay, let me write that down. TX-4892 and 917-555-0147. And I go to CVS?
Scammer: Yes, purchase the gift cards and call me back with the numbers on the back of the cards. Do this within the next hour or you will be arrested today.`;

    const result = await extractIntel(transcript);

    expect(result.scam_type).toBeTruthy();
    expect(result.scam_type!.toLowerCase()).toContain("irs");
    expect(result.payment_methods.length).toBeGreaterThan(0);
    expect(result.payment_methods[0].type).toContain("gift_card");
    expect(result.key_quotes.length).toBeGreaterThan(0);
    expect(["high", "medium"]).toContain(result.intel_quality);
    expect(result.confidence).toBeGreaterThan(0.5);
  }, 30000);

  it("returns low quality for a very short transcript", async () => {
    const transcript = `Bot: Hello?
Scammer: Is this Mrs. Johnson?`;

    const result = await extractIntel(transcript);

    expect(result.intel_quality).toBe("low");
    expect(result.confidence).toBeLessThanOrEqual(0.4);
  }, 30000);
});
