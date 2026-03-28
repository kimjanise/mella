import type { Call } from "../lib/mock-data";

interface Props {
  call: Call;
  isSelected: boolean;
  onClick: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const QUALITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "#dcfce7", text: "#166534" },
  medium: { bg: "#fef9c3", text: "#854d0e" },
  low: { bg: "#f1f5f9", text: "#64748b" },
};

export default function TraceRow({ call, isSelected, onClick }: Props) {
  const quality = call.intel_quality || "low";
  const qColors = QUALITY_COLORS[quality] || QUALITY_COLORS.low;

  return (
    <tr
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: isSelected ? "#eff6ff" : "transparent",
        borderBottom: "1px solid #f1f5f9",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget.style.background = "#f8fafc");
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget.style.background = "transparent");
      }}
    >
      <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#64748b" }}>
        {formatTimestamp(call.started_at)}
      </td>
      <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "#334155", fontFamily: "monospace" }}>
        {formatDuration(call.duration_seconds)}
      </td>
      <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "#0f172a", fontWeight: 500 }}>
        {call.personas?.name || "—"}
      </td>
      <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "#334155", fontFamily: "monospace" }}>
        {call.inbound_number || "Unknown"}
      </td>
      <td style={{ padding: "0.75rem 0.5rem" }}>
        {call.scam_type ? (
          <span
            style={{
              display: "inline-block",
              padding: "0.15rem 0.5rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 500,
              background: "#f1f5f9",
              color: "#475569",
            }}
          >
            {call.scam_type}
          </span>
        ) : (
          <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>—</span>
        )}
      </td>
      <td style={{ padding: "0.75rem 0.5rem" }}>
        <span
          style={{
            display: "inline-block",
            padding: "0.15rem 0.5rem",
            borderRadius: "9999px",
            fontSize: "0.7rem",
            fontWeight: 600,
            textTransform: "uppercase",
            background: qColors.bg,
            color: qColors.text,
          }}
        >
          {quality}
        </span>
      </td>
    </tr>
  );
}
