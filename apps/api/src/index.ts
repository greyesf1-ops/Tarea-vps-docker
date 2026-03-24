import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { serve } from "@hono/node-server";

import { env } from "./lib/env.js";
import { gradebookRoutes } from "./routes/gradebook.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*"
  })
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    timestamp: new Date().toISOString()
  })
);

app.route("/gradebook", gradebookRoutes);

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json(
      {
        message: error.message
      },
      error.status
    );
  }

  console.error(error);
  return c.json(
    {
      message: "Error interno del servidor."
    },
    500
  );
});

serve(
  {
    fetch: app.fetch,
    hostname: env.API_HOST,
    port: env.API_PORT
  },
  () => {
    console.log(`API disponible en http://${env.API_HOST}:${env.API_PORT}`);
  }
);
