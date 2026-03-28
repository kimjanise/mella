import { useEffect, useRef, useCallback } from "react";
import type { Call, Transcript as TranscriptType, IntelItem } from "../lib/mock-data";
import IntelChips from "./IntelChips";
import TranscriptView from "./Transcript";
import { downloadReport } from "../lib/data";

interface Props {
  call: Call | null;
  transcripts: TranscriptType[];
  intelItems: IntelItem[];
  onClose: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "N/A";
  return new Date(ts).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const QUALITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "#dcfce7", text: "#166534" },
  medium: { bg: "#fef9c3", text: "#854d0e" },
  low: { bg: "#f1f5f9", text: "#64748b" },
};

export default function DetailPanel({ call, transcripts, intelItems, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleKeyDown, handleClickOutside]);

  const isOpen = call !== null;
  const quotes = intelItems.filter((item) => item.field_type === "quote");
  const qualityStyle = call?.intel_quality ? QUALITY_COLORS[call.intel_quality] : QUALITY_COLORS.low;

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "42%",
        minWidth: "400px",
        height: "100vh",
        background: "#fff",
        borderLeft: "1px solid #e2e8f0",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s ease-in-out",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {call && (
        <>
          {/* Header */}
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexShrink: 0,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "#0f172a" }}>
                {call.personas?.name || "Unknown Persona"}
              </h2>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.375rem", fontSize: "0.8rem", color: "#64748b" }}>
                <span>{formatTimestamp(call.started_at)}</span>
                <span>{formatDuration(call.duration_seconds)}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {call.intel_quality && (
                <span
                  style={{
                    padding: "0.2rem 0.625rem",
                    borderRadius: "9999px",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    background: qualityStyle.bg,
                    color: qualityStyle.text,
                  }}
                >
                  {call.intel_quality}
                </span>
              )}
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.25rem",
                  color: "#94a3b8",
                  padding: "0.25rem",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
            {/* Metadata */}
            <div style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>
                Call Details
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem" }}>
                <div>
                  <span style={{ color: "#94a3b8" }}>Inbound: </span>
                  <span style={{ color: "#0f172a", fontWeight: 500 }}>{call.inbound_number || "Unknown"}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>Caller ID: </span>
                  <span style={{ color: "#0f172a", fontWeight: 500 }}>{call.caller_id_name || "Unknown"}</span>
                </div>
                {call.scam_type && (
                  <div>
                    <span style={{ color: "#94a3b8" }}>Scam Type: </span>
                    <span style={{ color: "#0f172a", fontWeight: 500 }}>{call.scam_type}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Intel Chips */}
            {intelItems.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>
                  Extracted Intelligence
                </h3>
                <IntelChips items={intelItems} />
              </div>
            )}

            {/* Key Quotes */}
            {quotes.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>
                  Key Quotes
                </h3>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {quotes.map((q) => (
                    <li key={q.id} style={{ fontSize: "0.85rem", color: "#334155", fontStyle: "italic" }}>
                      "{q.value}"
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Transcript */}
            <div style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>
                Transcript
              </h3>
              <TranscriptView turns={transcripts} />
            </div>
          </div>

          {/* Action buttons */}
          <div
            style={{
              padding: "1rem 1.5rem",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: "0.5rem",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => downloadReport(call.id)}
              style={{
                flex: 1,
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid #e2e8f0",
                background: "#0f172a",
                color: "#fff",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Download .docx
            </button>
            <a
              href="https://reportfraud.ftc.gov/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#0f172a",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "center",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              File with FTC
            </a>
            <a
              href="https://www.ic3.gov/Home/FileComplaint"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#0f172a",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "center",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              File with IC3
            </a>
          </div>
        </>
      )}
    </div>
  );
}
