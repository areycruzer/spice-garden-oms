import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

console.log(`Spice Garden API listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
