import "dotenv/config";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { handleWebhook } from "./routes/webhooks.js";
import { handleDeploy } from "./routes/deploy.js";
import { handleReport } from "./routes/reports.js";

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  const path = (req.url || "").replace(/\?.*$/, "");

  try {
    // Health
    if (path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Webhook
    if (path === "/webhooks/vapi" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const result = await handleWebhook(body);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    // Deploy
    const deployMatch = path.match(/^\/personas\/([^/]+)\/deploy$/);
    if (deployMatch && req.method === "POST") {
      const result = await handleDeploy(deployMatch[1]);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    // Report
    const reportMatch = path.match(/^\/calls\/([^/]+)\/report$/);
    if (reportMatch && req.method === "GET") {
      const result = await handleReport(reportMatch[1]);
      if (result.buffer) {
        res.writeHead(result.status, result.headers);
        res.end(result.buffer);
      } else {
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.body));
      }
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    console.error("Request error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => console.log(`Backend server running on port ${port}`));
