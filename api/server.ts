/**
 * Node HTTP server for Render / Railway / Fly / local
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import app from "./index";

const port = Number(process.env.PORT || 3001);

const root = new Hono();

root.get("/", (c) =>
  c.json({
    name: "AI Agent Manager API",
    status: "ok",
    health: "/api/health",
    docs: "UI is on GitHub Pages. Use /api/* endpoints.",
  })
);

root.route("/", app);

console.log(`AI Agent Manager API listening on :${port}`);
serve({
  fetch: root.fetch,
  port,
});
