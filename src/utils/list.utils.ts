import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { ApiError } from "utils/api-error.utils";

export type SortOrder = "asc" | "desc";

export const parseQ = (query: Record<string, unknown>): string | undefined => {
  const raw = query.q;
  if (typeof raw !== "string") return undefined;
  const q = raw.trim();
  return q.length > 0 ? q : undefined;
};

export const parseSort = (
  query: Record<string, unknown>,
  {
    allowSortBy,
    defaultSortBy,
    defaultSortOrder = "desc"
  }: { allowSortBy: readonly string[]; defaultSortBy: string; defaultSortOrder?: SortOrder }
): { sortBy: string; sortOrder: SortOrder } => {
  const rawSortBy = typeof query.sortBy === "string" ? query.sortBy.trim() : "";
  const sortBy = allowSortBy.includes(rawSortBy) ? rawSortBy : defaultSortBy;

  const rawSortOrder =
    typeof query.sortOrder === "string" ? query.sortOrder.trim().toLowerCase() : "";
  const sortOrder: SortOrder =
    rawSortOrder === "asc" ? "asc" : rawSortOrder === "desc" ? "desc" : defaultSortOrder;

  return { sortBy, sortOrder };
};

export const buildListResponse = <T>(options: {
  items: T[];
  page: number;
  limit: number;
  total: number;
}): { items: T[]; page: number; limit: number; total: number; totalPages: number } => {
  const { items, page, limit, total } = options;
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { items, page, limit, total, totalPages };
};

export const assertUuidParam = (value: string | undefined): void => {
  if (!value) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(value)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }
};
