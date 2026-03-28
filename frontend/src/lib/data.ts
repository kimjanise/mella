import { supabase } from "../supabase";
import {
  mockCalls,
  mockTranscripts,
  mockIntelItems,
  mockPersonas,
  type Call,
  type Transcript,
  type IntelItem,
  type Persona,
} from "./mock-data";

const useMock = import.meta.env.VITE_USE_MOCK === "true";
const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// --- Calls ---

export async function fetchCalls(): Promise<Call[]> {
  if (useMock) return mockCalls;

  const { data, error } = await supabase
    .from("calls")
    .select("*, personas(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch calls:", error);
    return [];
  }
  return data as Call[];
}

export async function fetchTranscripts(callId: string): Promise<Transcript[]> {
  if (useMock) return mockTranscripts[callId] || [];

  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("call_id", callId)
    .order("turn_index", { ascending: true });

  if (error) {
    console.error("Failed to fetch transcripts:", error);
    return [];
  }
  return data as Transcript[];
}

export async function fetchIntelItems(callId: string): Promise<IntelItem[]> {
  if (useMock) return mockIntelItems[callId] || [];

  const { data, error } = await supabase
    .from("intel_items")
    .select("*")
    .eq("call_id", callId);

  if (error) {
    console.error("Failed to fetch intel items:", error);
    return [];
  }
  return data as IntelItem[];
}

// --- Personas ---

export async function fetchPersonas(): Promise<Persona[]> {
  if (useMock) return mockPersonas;

  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch personas:", error);
    return [];
  }
  return data as Persona[];
}

export async function createPersona(
  persona: Omit<Persona, "id" | "vapi_assistant_id" | "phone_number" | "is_active" | "created_at">
): Promise<Persona | null> {
  if (useMock) return null;

  const { data, error } = await supabase
    .from("personas")
    .insert(persona)
    .select()
    .single();

  if (error) {
    console.error("Failed to create persona:", error);
    return null;
  }
  return data as Persona;
}

export async function updatePersona(
  id: string,
  updates: Partial<Persona>
): Promise<Persona | null> {
  if (useMock) return null;

  const { data, error } = await supabase
    .from("personas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update persona:", error);
    return null;
  }
  return data as Persona;
}

export async function deletePersona(id: string): Promise<boolean> {
  if (useMock) return false;

  const { error } = await supabase.from("personas").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete persona:", error);
    return false;
  }
  return true;
}

export async function deployPersona(id: string): Promise<{ assistant_id: string; phone_number: string } | null> {
  const res = await fetch(`${backendUrl}/personas/${id}/deploy`, { method: "POST" });
  if (!res.ok) {
    console.error("Deploy failed:", await res.text());
    return null;
  }
  return res.json();
}

export async function downloadReport(callId: string): Promise<void> {
  const res = await fetch(`${backendUrl}/calls/${callId}/report`);
  if (!res.ok) {
    console.error("Report download failed:", await res.text());
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mella-report-${callId}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
