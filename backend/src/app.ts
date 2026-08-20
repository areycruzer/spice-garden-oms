import { Hono } from "hono";
import { cors } from "hono/cors";
import { AppError } from "./lib/errors.js";
import { errorBody } from "./lib/response.js";
import { customersRouter } from "./routes/customers.js";
import { opsRouter } from "./routes/ops.js";
import { ordersRouter } from "./routes/orders.js";

export function createApp() {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return origin;
        const allowed = [
          process.env.FRONTEND_ORIGIN,
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:5180",
        ].filter(Boolean) as string[];

        if (
          allowed.includes(origin) ||
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:") ||
          origin.endsWith(".vercel.app") ||
          origin.endsWith(".onrender.com")
        ) {
          return origin;
        }
        return null;
      },
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/customers", customersRouter);
  app.route("/orders", ordersRouter);
  app.route("/ops", opsRouter);

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(errorBody(err.code, err.message), err.httpStatus as 400 | 404 | 409);
    }

    console.error(err);
    return c.json(
      errorBody("VALIDATION_FAILED", err.message || "Internal server error"),
      500,
    );
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;
