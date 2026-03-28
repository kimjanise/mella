import type { Transcript as TranscriptType } from "../lib/mock-data";

interface Props {
  turns: TranscriptType[];
}

function formatTime(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function Transcript({ turns }: Props) {
  if (turns.length === 0) {
    return <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No transcript available.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {turns.map((turn) => {
        const isBot = turn.speaker === "bot";
        return (
          <div
            key={turn.id ?? turn.turn_index}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.125rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              background: isBot ? "#eff6ff" : "#fef2f2",
              borderLeft: `3px solid ${isBot ? "#3b82f6" : "#ef4444"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: isBot ? "#2563eb" : "#dc2626",
                }}
              >
                {isBot ? "Bot" : "Scammer"}
              </span>
              {turn.timestamp && (
                <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                  {formatTime(turn.timestamp)}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5, color: "#1e293b" }}>
              {turn.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
