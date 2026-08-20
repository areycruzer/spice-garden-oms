import { invalidFilter } from "./errors.js";
import type { PaginationMeta } from "./response.js";

export type PaginationParams = {
  page: number;
  size: number;
  offset: number;
};

export function parsePagination(
  pageRaw: string | undefined,
  sizeRaw: string | undefined,
): PaginationParams {
  const page = pageRaw === undefined || pageRaw === "" ? 1 : Number(pageRaw);
  const size = sizeRaw === undefined || sizeRaw === "" ? 10 : Number(sizeRaw);

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(size) ||
    page < 1 ||
    size < 1 ||
    size > 100
  ) {
    throw invalidFilter(
      "Invalid pagination parameters: page must be >= 1 and size must be between 1 and 100",
    );
  }

  return { page, size, offset: (page - 1) * size };
}

export function buildPaginationMeta(
  page: number,
  size: number,
  total: number,
): PaginationMeta {
  return {
    page,
    size,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / size),
  };
}
