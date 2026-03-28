import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";

export interface ReportCall {
  id: string;
  inbound_number: string | null;
  caller_id_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  scam_type: string | null;
  intel_quality: string | null;
}

export interface ReportTranscript {
  turn_index: number;
  speaker: string;
  text: string;
  timestamp: string | null;
}

export interface ReportIntelItem {
  field_type: string;
  value: string;
  metadata: Record<string, unknown> | null;
  confidence: number | null;
  flagged_high_value: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "N/A";
  return new Date(ts).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function cellBorders() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "cccccc" };
  return { top: border, bottom: border, left: border, right: border };
}

function headerCell(text: string): TableCell {
  return new TableCell({
    borders: cellBorders(),
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })] })],
  });
}

function dataCell(text: string): TableCell {
  return new TableCell({
    borders: cellBorders(),
    children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
  });
}

export async function generateReport(
  call: ReportCall,
  transcripts: ReportTranscript[],
  intelItems: ReportIntelItem[],
  personaName: string
): Promise<Buffer> {
  const sections: Paragraph[] = [];

  // --- Section 1: Header ---
  sections.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Mella Intelligence Report", bold: true, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}`,
          size: 20,
          color: "666666",
        }),
      ],
    })
  );

  // --- Section 2: Call Summary ---
  sections.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
      children: [new TextRun({ text: "Call Summary" })],
    })
  );

  const summaryRows = [
    ["Persona", personaName],
    ["Inbound Number", call.inbound_number || "Unknown"],
    ["Caller ID Name", call.caller_id_name || "Unknown"],
    ["Start Time", formatTimestamp(call.started_at)],
    ["Duration", formatDuration(call.duration_seconds)],
    ["Scam Type", call.scam_type || "Unclassified"],
    ["Intel Quality", call.intel_quality || "Pending"],
  ];

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: summaryRows.map(
      ([label, value]) =>
        new TableRow({ children: [headerCell(label), dataCell(value)] })
    ),
  });

  sections.push(summaryTable as unknown as Paragraph);

  // --- Section 3: Extracted Intelligence ---
  const nonQuoteItems = intelItems.filter((item) => item.field_type !== "quote");

  if (nonQuoteItems.length > 0) {
    sections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: "Extracted Intelligence" })],
      })
    );

    const intelTableRows = [
      new TableRow({
        children: [headerCell("Type"), headerCell("Value"), headerCell("Confidence")],
      }),
      ...nonQuoteItems.map(
        (item) =>
          new TableRow({
            children: [
              dataCell(item.field_type.replace(/_/g, " ")),
              dataCell(item.value),
              dataCell(item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : "N/A"),
            ],
          })
      ),
    ];

    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: intelTableRows,
      }) as unknown as Paragraph
    );
  }

  // --- Section 4: Key Quotes ---
  const quotes = intelItems.filter((item) => item.field_type === "quote");

  if (quotes.length > 0) {
    sections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: "Key Quotes" })],
      })
    );

    for (const quote of quotes) {
      sections.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: `"${quote.value}"`, italics: true, size: 20 })],
        })
      );
    }
  }

  // --- Section 5: Full Transcript ---
  sections.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "Full Transcript" })],
    })
  );

  for (const turn of transcripts) {
    const speaker = turn.speaker === "bot" ? "Bot" : "Scammer";
    const time = turn.timestamp ? formatTimestamp(turn.timestamp) : "";
    sections.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `[${speaker}]`, bold: true, size: 20 }),
          ...(time ? [new TextRun({ text: ` ${time}`, size: 18, color: "999999" })] : []),
          new TextRun({ text: `  ${turn.text}`, size: 20 }),
        ],
      })
    );
  }

  // --- Section 6: Submission Notes ---
  sections.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "Submission Notes" })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "FTC Filing Reference: ________________________________",
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "IC3 Filing Reference: ________________________________",
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "This report was auto-generated by Mella. Verify all extracted intelligence before submission to law enforcement.",
          size: 18,
          color: "999999",
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [{ children: sections }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
