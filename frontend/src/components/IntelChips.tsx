import type { IntelItem } from "../lib/mock-data";

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  entity_impersonated: { bg: "#fef2f2", text: "#991b1b" },
  agent_name: { bg: "#f0fdf4", text: "#166534" },
  badge_number: { bg: "#f0fdf4", text: "#166534" },
  phone: { bg: "#eff6ff", text: "#1e40af" },
  callback_number: { bg: "#eff6ff", text: "#1e40af" },
  gift_card: { bg: "#fefce8", text: "#854d0e" },
  wallet: { bg: "#faf5ff", text: "#6b21a8" },
  bank: { bg: "#faf5ff", text: "#6b21a8" },
  email: { bg: "#f0fdfa", text: "#115e59" },
  website: { bg: "#f0fdfa", text: "#115e59" },
};

const TYPE_LABELS: Record<string, string> = {
  entity_impersonated: "Entity",
  agent_name: "Agent Name",
  badge_number: "Badge #",
  phone: "Phone",
  callback_number: "Callback #",
  gift_card: "Gift Card",
  wallet: "Crypto Wallet",
  bank: "Bank",
  email: "Email",
  website: "Website",
};

interface Props {
  items: IntelItem[];
}

export default function IntelChips({ items }: Props) {
  const nonQuotes = items.filter((item) => item.field_type !== "quote");

  if (nonQuotes.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {nonQuotes.map((item) => {
        const colors = TYPE_COLORS[item.field_type] || { bg: "#f1f5f9", text: "#475569" };
        return (
          <div
            key={item.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.8rem",
              fontWeight: 500,
              background: colors.bg,
              color: colors.text,
              border: item.flagged_high_value ? `1.5px solid ${colors.text}` : "1px solid transparent",
            }}
          >
            <span style={{ fontSize: "0.7rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {TYPE_LABELS[item.field_type] || item.field_type}
            </span>
            <span>{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
