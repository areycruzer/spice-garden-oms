import type { Hook } from "@hono/zod-validator";
import type { Env, ValidationTargets } from "hono";
import { validationFailed } from "./errors.js";

export const zodErrorHook: Hook<
  unknown,
  Env,
  string,
  keyof ValidationTargets
> = (result) => {
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "body";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    throw validationFailed(details || "Validation failed");
  }
};
