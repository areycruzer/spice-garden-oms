import type { OrderStatus } from "./status.js";

export type DiningPhase =
  | "queued"
  | "cooking"
  | "plated"
  | "done"
  | "cancelled";

export type OpsInsight = {
  diningPhase: DiningPhase;
  dwellMinutes: number;
  quotedReadyMinutes: number | null;
  suggestedAction: string;
};

export function diningPhase(status: OrderStatus): DiningPhase {
  switch (status) {
    case "CONFIRMED":
      return "queued";
    case "PREPARING":
      return "cooking";
    case "READY":
      return "plated";
    case "COMPLETED":
      return "done";
    case "CANCELLED":
      return "cancelled";
  }
}

/** Minutes remaining in the CONFIRMED (queued) phase. */
export function confirmedPhaseMinutes(itemCount: number): number {
  return Math.ceil(2 + 0.5 * itemCount);
}

/** Minutes remaining in the PREPARING (cooking) phase. */
export function preparingPhaseMinutes(itemCount: number): number {
  return Math.ceil(Math.max(3, 1.5 * itemCount));
}

/**
 * Deterministic ETA to READY (not ML).
 * CONFIRMED: queued + cooking; PREPARING: cooking only; READY: 0.
 */
export function quotedReadyMinutes(
  status: OrderStatus,
  itemCount: number,
): number | null {
  switch (status) {
    case "CONFIRMED":
      return confirmedPhaseMinutes(itemCount) + preparingPhaseMinutes(itemCount);
    case "PREPARING":
      return preparingPhaseMinutes(itemCount);
    case "READY":
      return 0;
    case "COMPLETED":
    case "CANCELLED":
      return null;
  }
}

export function suggestedAction(
  status: OrderStatus,
  dwellMinutes: number,
  itemCount: number,
): string {
  switch (status) {
    case "CONFIRMED":
      return dwellMinutes >= confirmedPhaseMinutes(itemCount)
        ? `Mark PREPARING — party waiting ${dwellMinutes}m`
        : `Queue OK — start prep in ~${Math.max(0, confirmedPhaseMinutes(itemCount) - dwellMinutes)}m`;
    case "PREPARING": {
      const eta = preparingPhaseMinutes(itemCount);
      return dwellMinutes >= eta
        ? `Mark READY — cooking ${dwellMinutes}m (past quote)`
        : `Cooking — ~${Math.max(0, eta - dwellMinutes)}m to plated`;
    }
    case "READY":
      return dwellMinutes >= 5
        ? `Seat or complete — plated ${dwellMinutes}m (risk of cold food)`
        : "Plated — ready for host pickup / seating";
    case "COMPLETED":
      return "Order complete — table can turn";
    case "CANCELLED":
      return "Cancelled — clear any seating assignment";
  }
}

export function buildOpsInsight(
  status: OrderStatus,
  itemCount: number,
  statusChangedAt: Date,
  now: Date = new Date(),
): OpsInsight {
  const dwellMinutes = Math.max(
    0,
    Math.floor((now.getTime() - statusChangedAt.getTime()) / 60_000),
  );

  return {
    diningPhase: diningPhase(status),
    dwellMinutes,
    quotedReadyMinutes: quotedReadyMinutes(status, itemCount),
    suggestedAction: suggestedAction(status, dwellMinutes, itemCount),
  };
}
