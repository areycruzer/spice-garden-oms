export type PaginationMeta = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

export function okData<T>(data: T) {
  return { data };
}

export function okPaginated<T>(data: T, pagination: PaginationMeta) {
  return {
    data,
    meta: { pagination },
  };
}

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}
