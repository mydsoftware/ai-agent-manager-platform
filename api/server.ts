/**
 * Node HTTP server for Render / Railway / Fly / self-hosted
 * Serves both the API under /api and the static dashboard from ./public
 */
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import app from "./index";

const port = Number(process.env.PORT || 3001);

const root = new Hono();

root.route("/", app);
root.use("*", serveStatic({ root: "./public" }));
root.get("*", (c) => c.notFound());

console.log(`AI Agent Manager listening on :${port}`);
serve({
  fetch: root.fetch,
  port,
});
