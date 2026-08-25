/**
 * Node HTTP server for Render / Railway / Fly / local
 */
import { serve } from "@hono/node-server";
import app from "./index";

const port = Number(process.env.PORT || 3001);

console.log(`AI Agent Manager API listening on :${port}`);
serve({
  fetch: app.fetch,
  port,
});
