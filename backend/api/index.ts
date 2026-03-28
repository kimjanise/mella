import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleWebhook } from "../src/routes/webhooks.js";
import { handleDeploy } from "../src/routes/deploy.js";
import { handleReport } from "../src/routes/reports.js";

export const config = { maxDuration: 60 };

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const path = (req.url || "").replace(/\?.*$/, "");

  try {
    if (path === "/api/health") {
      return res.json({ status: "ok" });
    }

    if (path === "/api/webhooks/vapi" && req.method === "POST") {
      const result = await handleWebhook(req.body);
      return res.status(result.status).json(result.body);
    }

    const deployMatch = path.match(/^\/api\/personas\/([^/]+)\/deploy$/);
    if (deployMatch && req.method === "POST") {
      const result = await handleDeploy(deployMatch[1]);
      return res.status(result.status).json(result.body);
    }

    const reportMatch = path.match(/^\/api\/calls\/([^/]+)\/report$/);
    if (reportMatch && req.method === "GET") {
      const result = await handleReport(reportMatch[1]);
      if (result.buffer) {
        res.setHeader("Content-Type", result.headers!["Content-Type"]);
        res.setHeader("Content-Disposition", result.headers!["Content-Disposition"]);
        return res.send(result.buffer);
      }
      return res.status(result.status).json(result.body);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err) {
    console.error("Request error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
