import { useState, useEffect } from "react";
import type { Persona } from "../lib/mock-data";

interface Props {
  persona?: Persona | null;
  onSave: (data: PersonaFormData) => void;
  onCancel: () => void;
}

export interface PersonaFormData {
  name: string;
  age: number | null;
  backstory: string;
  voice_model: string;
  system_prompt: string;
  target_scam_types: string[];
  stall_tactics: string[];
}

export default function PersonaForm({ persona, onSave, onCancel }: Props) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [backstory, setBackstory] = useState("");
  const [voiceModel, setVoiceModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [targetScamTypes, setTargetScamTypes] = useState("");
  const [stallTactics, setStallTactics] = useState("");

  useEffect(() => {
    if (persona) {
      setName(persona.name);
      setAge(persona.age?.toString() || "");
      setBackstory(persona.backstory || "");
      setVoiceModel(persona.voice_model);
      setSystemPrompt(persona.system_prompt);
      setTargetScamTypes((persona.target_scam_types || []).join(", "));
      setStallTactics((persona.stall_tactics || []).join(", "));
    }
  }, [persona]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      age: age ? parseInt(age, 10) : null,
      backstory,
      voice_model: voiceModel,
      system_prompt: systemPrompt,
      target_scam_types: targetScamTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      stall_tactics: stallTactics
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    color: "#0f172a",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#64748b",
    marginBottom: "0.25rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "#0f172a" }}>
        {persona ? "Edit Persona" : "Create Persona"}
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Margaret"
          />
        </div>
        <div>
          <label style={labelStyle}>Age</label>
          <input
            style={inputStyle}
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="78"
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Backstory</label>
        <textarea
          style={{ ...inputStyle, minHeight: "4rem", resize: "vertical" }}
          value={backstory}
          onChange={(e) => setBackstory(e.target.value)}
          placeholder="Retired schoolteacher from Ohio. Lives alone, trusting..."
        />
      </div>

      <div>
        <label style={labelStyle}>Voice Model (ElevenLabs ID) *</label>
        <input
          style={inputStyle}
          value={voiceModel}
          onChange={(e) => setVoiceModel(e.target.value)}
          required
          placeholder="EXAVITQu4vr4xnSDxMaL"
        />
      </div>

      <div>
        <label style={labelStyle}>System Prompt *</label>
        <textarea
          style={{ ...inputStyle, minHeight: "6rem", resize: "vertical" }}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          required
          placeholder="You are Margaret, a 78-year-old retired teacher..."
        />
      </div>

      <div>
        <label style={labelStyle}>Target Scam Types (comma-separated)</label>
        <input
          style={inputStyle}
          value={targetScamTypes}
          onChange={(e) => setTargetScamTypes(e.target.value)}
          placeholder="irs, tech_support, social_security"
        />
      </div>

      <div>
        <label style={labelStyle}>Stall Tactics (comma-separated)</label>
        <input
          style={inputStyle}
          value={stallTactics}
          onChange={(e) => setStallTactics(e.target.value)}
          placeholder="ask to repeat, feign confusion, tell stories"
        />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#64748b",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "0.375rem",
            border: "none",
            background: "#0f172a",
            color: "#fff",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {persona ? "Save Changes" : "Create Persona"}
        </button>
      </div>
    </form>
  );
}
