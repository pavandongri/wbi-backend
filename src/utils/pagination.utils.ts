export type PaginationParams = {
  page: number;
  limit: number;
  offset: number;
};

const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) return value > 0 ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

export const parsePagination = (
  query: Record<string, unknown>,
  {
    defaultPage = 1,
    defaultLimit = 20,
    maxLimit = 100
  }: { defaultPage?: number; defaultLimit?: number; maxLimit?: number } = {}
): PaginationParams => {
  const page = toPositiveInt(query.page) ?? defaultPage;
  const limitUnclamped = toPositiveInt(query.limit) ?? defaultLimit;
  const limit = Math.min(limitUnclamped, maxLimit);

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
};
