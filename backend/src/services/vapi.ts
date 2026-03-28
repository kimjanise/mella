const VAPI_BASE_URL = "https://api.vapi.ai";

function getApiKey(): string {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY is not set");
  return key;
}

async function vapiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${VAPI_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

export interface VapiAssistant {
  id: string;
  name?: string;
}

export interface VapiPhoneNumber {
  id: string;
  assistantId?: string;
}

export async function createAssistant(
  systemPrompt: string,
  voiceModel: string,
  name?: string
): Promise<VapiAssistant> {
  const payload = {
    name: name || "Mella Persona",
    model: {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nIMPORTANT: Keep every response to 2 sentences maximum. Be concise and conversational.`,
        },
      ],
    },
    voice: {
      provider: "11labs",
      voiceId: voiceModel,
    },
    firstMessage: "Hello?",
  };

  const result = (await vapiRequest("POST", "/assistant", payload)) as VapiAssistant;
  return result;
}

export async function updateAssistant(
  assistantId: string,
  systemPrompt: string,
  voiceModel: string,
  name?: string
): Promise<VapiAssistant> {
  const payload = {
    ...(name ? { name } : {}),
    model: {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nIMPORTANT: Keep every response to 2 sentences maximum. Be concise and conversational.`,
        },
      ],
    },
    voice: {
      provider: "11labs",
      voiceId: voiceModel,
    },
  };

  const result = (await vapiRequest("PATCH", `/assistant/${assistantId}`, payload)) as VapiAssistant;
  return result;
}

export async function assignPhoneNumber(
  phoneNumberId: string,
  assistantId: string
): Promise<VapiPhoneNumber> {
  const payload = {
    assistantId,
  };

  const result = (await vapiRequest("PATCH", `/phone-number/${phoneNumberId}`, payload)) as VapiPhoneNumber;
  return result;
}
