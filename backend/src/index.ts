import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import webhooks from "./routes/webhooks.js";
import deploy from "./routes/deploy.js";
import reports from "./routes/reports.js";

const app = new Hono();

app.use("/*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/", webhooks);
app.route("/", deploy);
app.route("/", reports);

const port = Number(process.env.PORT) || 3001;

console.log(`Backend server starting on port ${port}`);

serve({ fetch: app.fetch, port });

export default app;
