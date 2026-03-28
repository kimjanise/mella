import { useState, useEffect, useCallback } from "react";
import type { Persona } from "../lib/mock-data";
import {
  fetchPersonas,
  createPersona,
  updatePersona,
  deletePersona,
  deployPersona,
} from "../lib/data";
import PersonaForm, { type PersonaFormData } from "../components/PersonaForm";

export default function Personas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [deploying, setDeploying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchPersonas();
    setPersonas(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = () => {
    setEditingPersona(null);
    setShowForm(true);
  };

  const handleEdit = (persona: Persona) => {
    setEditingPersona(persona);
    setShowForm(true);
  };

  const handleSave = async (data: PersonaFormData) => {
    if (editingPersona) {
      await updatePersona(editingPersona.id, data);
    } else {
      await createPersona(data);
    }
    setShowForm(false);
    setEditingPersona(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this persona?")) return;
    await deletePersona(id);
    await load();
  };

  const handleDeploy = async (id: string) => {
    setDeploying(id);
    const result = await deployPersona(id);
    setDeploying(null);
    if (result) {
      await load();
    } else {
      alert("Deploy failed. Check backend logs.");
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem", color: "#94a3b8" }}>
        Loading personas...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>Personas</h1>
        {!showForm && (
          <button
            onClick={handleCreate}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              background: "#0f172a",
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            + New Persona
          </button>
        )}
      </div>

      {showForm && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <PersonaForm
            persona={editingPersona}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingPersona(null);
            }}
          />
        </div>
      )}

      {personas.length === 0 && !showForm ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            color: "#94a3b8",
            background: "#f8fafc",
            borderRadius: "0.5rem",
            border: "1px dashed #e2e8f0",
          }}
        >
          <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No personas yet</p>
          <p style={{ fontSize: "0.85rem" }}>Create a bot persona to get started.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {personas.map((persona) => (
            <div
              key={persona.id}
              style={{
                background: "#fff",
                border: `1px solid ${persona.is_active ? "#22c55e" : "#e2e8f0"}`,
                borderRadius: "0.5rem",
                padding: "1.25rem 1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                  <span style={{ fontSize: "1.05rem", fontWeight: 600, color: "#0f172a" }}>
                    {persona.name}
                  </span>
                  {persona.age && (
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Age {persona.age}</span>
                  )}
                  {persona.is_active && (
                    <span
                      style={{
                        padding: "0.1rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        background: "#dcfce7",
                        color: "#166534",
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>
                {persona.backstory && (
                  <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 0.5rem" }}>
                    {persona.backstory}
                  </p>
                )}
                {persona.target_scam_types && persona.target_scam_types.length > 0 && (
                  <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                    {persona.target_scam_types.map((type) => (
                      <span
                        key={type}
                        style={{
                          padding: "0.1rem 0.5rem",
                          borderRadius: "9999px",
                          fontSize: "0.7rem",
                          background: "#f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, marginLeft: "1rem" }}>
                <button
                  onClick={() => handleEdit(persona)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeploy(persona.id)}
                  disabled={deploying === persona.id || persona.is_active}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    background: persona.is_active ? "#94a3b8" : "#2563eb",
                    color: "#fff",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    cursor: persona.is_active ? "default" : "pointer",
                    opacity: deploying === persona.id ? 0.6 : 1,
                  }}
                >
                  {deploying === persona.id ? "Deploying..." : persona.is_active ? "Deployed" : "Deploy"}
                </button>
                <button
                  onClick={() => handleDelete(persona.id)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #fecaca",
                    background: "#fff",
                    color: "#dc2626",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
