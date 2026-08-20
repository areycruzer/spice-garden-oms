import { describe, expect, it } from "vitest";
import {
  buildOpsInsight,
  confirmedPhaseMinutes,
  preparingPhaseMinutes,
  quotedReadyMinutes,
} from "../lib/ops-insight.js";

describe("opsInsight heuristic", () => {
  it("computes phase minutes from itemCount", () => {
    expect(confirmedPhaseMinutes(4)).toBe(4);
    expect(preparingPhaseMinutes(4)).toBe(6);
    expect(quotedReadyMinutes("CONFIRMED", 4)).toBe(10);
    expect(quotedReadyMinutes("PREPARING", 4)).toBe(6);
    expect(quotedReadyMinutes("READY", 4)).toBe(0);
    expect(quotedReadyMinutes("COMPLETED", 4)).toBeNull();
  });

  it("builds dwell and suggested action", () => {
    const changed = new Date("2026-01-01T12:00:00.000Z");
    const now = new Date("2026-01-01T12:12:00.000Z");
    const insight = buildOpsInsight("CONFIRMED", 4, changed, now);
    expect(insight.dwellMinutes).toBe(12);
    expect(insight.diningPhase).toBe("queued");
    expect(insight.suggestedAction).toContain("Mark PREPARING");
  });
});
