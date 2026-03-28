import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { Call, Transcript, IntelItem } from "../lib/mock-data";
import { fetchCalls, fetchTranscripts, fetchIntelItems } from "../lib/data";
import TraceRow from "../components/TraceRow";
import DetailPanel from "../components/DetailPanel";

export default function Traces() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [intelItems, setIntelItems] = useState<IntelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  // Load calls on mount
  useEffect(() => {
    fetchCalls().then((data) => {
      setCalls(data);
      setLoading(false);

      // Auto-open panel from URL param
      const callId = searchParams.get("call");
      if (callId) {
        const match = data.find((c) => c.id === callId);
        if (match) selectCall(match);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectCall = useCallback(async (call: Call) => {
    setSelectedCall(call);
    setSearchParams({ call: call.id }, { replace: true });

    const [t, i] = await Promise.all([
      fetchTranscripts(call.id),
      fetchIntelItems(call.id),
    ]);
    setTranscripts(t);
    setIntelItems(i);
  }, [setSearchParams]);

  const closePanel = useCallback(() => {
    setSelectedCall(null);
    setTranscripts([]);
    setIntelItems([]);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem", color: "#94a3b8" }}>
        Loading calls...
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>Traces</h1>
        <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
          {calls.length} call{calls.length !== 1 ? "s" : ""}
        </span>
      </div>

      {calls.length === 0 ? (
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
          <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No calls yet</p>
          <p style={{ fontSize: "0.85rem" }}>Calls will appear here after they complete.</p>
        </div>
      ) : (
        <div
          style={{
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={thStyle}>Timestamp</th>
                <th style={thStyle}>Duration</th>
                <th style={thStyle}>Persona</th>
                <th style={thStyle}>Inbound Number</th>
                <th style={thStyle}>Scam Type</th>
                <th style={thStyle}>Intel Quality</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <TraceRow
                  key={call.id}
                  call={call}
                  isSelected={selectedCall?.id === call.id}
                  onClick={() => selectCall(call)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailPanel
        call={selectedCall}
        transcripts={transcripts}
        intelItems={intelItems}
        onClose={closePanel}
      />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.625rem 1rem",
  textAlign: "left",
  fontSize: "0.7rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#94a3b8",
};
