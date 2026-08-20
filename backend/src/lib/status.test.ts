import { describe, expect, it } from "vitest";
import {
  canMutateItems,
  canTransition,
  isOrderStatus,
  STATUS_TRANSITIONS,
} from "./status.js";
import { buildPaginationMeta, parsePagination } from "./pagination.js";
import { AppError } from "./errors.js";

describe("status machine", () => {
  it("allows only defined transitions", () => {
    expect(canTransition("CONFIRMED", "PREPARING")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "READY")).toBe(false);
    expect(canTransition("PREPARING", "READY")).toBe(true);
    expect(canTransition("READY", "COMPLETED")).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });

  it("marks terminal statuses", () => {
    expect(STATUS_TRANSITIONS.COMPLETED).toEqual([]);
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("allows item mutation only for CONFIRMED/PREPARING", () => {
    expect(canMutateItems("CONFIRMED")).toBe(true);
    expect(canMutateItems("PREPARING")).toBe(true);
    expect(canMutateItems("READY")).toBe(false);
    expect(canMutateItems("COMPLETED")).toBe(false);
    expect(canMutateItems("CANCELLED")).toBe(false);
  });

  it("validates status strings", () => {
    expect(isOrderStatus("CONFIRMED")).toBe(true);
    expect(isOrderStatus("bogus")).toBe(false);
  });
});

describe("pagination", () => {
  it("defaults page=1 size=10", () => {
    expect(parsePagination(undefined, undefined)).toEqual({
      page: 1,
      size: 10,
      offset: 0,
    });
  });

  it("rejects invalid params", () => {
    expect(() => parsePagination("0", "10")).toThrow(AppError);
    expect(() => parsePagination("1", "101")).toThrow(AppError);
    expect(() => parsePagination("abc", "10")).toThrow(AppError);
  });

  it("computes totalPages", () => {
    expect(buildPaginationMeta(1, 10, 16)).toEqual({
      page: 1,
      size: 10,
      total: 16,
      totalPages: 2,
    });
    expect(buildPaginationMeta(1, 10, 0)).toEqual({
      page: 1,
      size: 10,
      total: 0,
      totalPages: 0,
    });
  });
});
