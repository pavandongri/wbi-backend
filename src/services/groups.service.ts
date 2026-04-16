import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies, groups } from "db/schema";
import { AuthContext } from "types/common.types";
import { CreateGroupPayload, Group, UpdateGroupPayload } from "types/groups.types";
import { ApiError } from "utils/api-error.utils";
import { assertCompanyScope, handleUniqueViolation, isSuperAdmin } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

export const mapSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    name: groups.name,
    description: groups.description,
    status: groups.status,
    createdAt: groups.createdAt,
    updatedAt: groups.updatedAt
  };
  return sortMap[sortBy] ?? groups.createdAt;
};

export const createGroup = async (
  payload: CreateGroupPayload,
  auth: AuthContext
): Promise<Group> => {
  if (!payload?.companyId || !payload?.name) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  assertCompanyScope(auth, payload.companyId);

  if (payload.status && payload.status !== "active") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  const companyRows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, payload.companyId), eq(companies.status, "active")))
    .limit(1);

  if (!companyRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  const insertValues = {
    companyId: payload.companyId,
    name: payload.name,
    description: payload.description,
    status: "active" as const,
    createdBy: auth.userId
  };

  try {
    const rows = await db.insert(groups).values(insertValues).returning();
    const created = rows[0];
    if (!created) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
      );
    }
    return created;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const getGroupById = async (id: string, auth: AuthContext): Promise<Group> => {
  assertUuidParam(id);

  const conditions: any[] = [eq(groups.id, id), eq(groups.status, "active")];
  if (!isSuperAdmin(auth.role)) {
    conditions.push(eq(groups.companyId, auth.companyId));
  }

  const whereCond = and(...conditions);

  const rows = await db.select().from(groups).where(whereCond).limit(1);
  const group = rows[0];
  if (!group) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }
  return group;
};

export const listGroups = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{ items: Group[]; page: number; limit: number; total: number; totalPages: number }> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["name", "status", "createdAt", "updatedAt", "description"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const baseConditions: any[] = [eq(groups.status, "active")];
  if (!isSuperAdmin(auth.role)) {
    baseConditions.push(eq(groups.companyId, auth.companyId));
  }

  const statusQuery = typeof query.status === "string" ? query.status.trim() : "";
  if (statusQuery.length > 0 && statusQuery !== "active") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  if (q) {
    baseConditions.push(or(ilike(groups.name, `%${q}%`), ilike(groups.description, `%${q}%`)));
  }

  const whereCond = and(...baseConditions);

  const countRows = await db
    .select({ total: count(groups.id) })
    .from(groups)
    .where(whereCond);
  const total = Number(countRows[0]?.total ?? 0);

  const itemsRows = await db
    .select()
    .from(groups)
    .where(whereCond)
    .limit(limit)
    .offset(offset)
    .orderBy(orderBy);

  return buildListResponse({ items: itemsRows as Group[], page, limit, total });
};

export const updateGroup = async (
  id: string,
  payload: UpdateGroupPayload,
  auth: AuthContext
): Promise<Group> => {
  assertUuidParam(id);

  if (payload.companyId !== undefined) {
    assertCompanyScope(auth, payload.companyId);

    if (!isSuperAdmin(auth.role)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, HTTP_MESSAGES.ERROR.FORBIDDEN);
    }
  }

  if (payload.status && payload.status !== "active") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  const conditions: any[] = [eq(groups.id, id), eq(groups.status, "active")];
  if (!isSuperAdmin(auth.role)) {
    conditions.push(eq(groups.companyId, auth.companyId));
  }

  const whereCond = and(...conditions);

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date()
  };

  if (payload.name !== undefined) updateValues.name = payload.name;
  if (payload.description !== undefined) updateValues.description = payload.description;
  if (payload.status !== undefined) updateValues.status = "active";
  // Restrict updates: don't allow changing companyId unless super_admin.
  if (payload.companyId !== undefined && isSuperAdmin(auth.role)) {
    updateValues.companyId = payload.companyId;
  }

  try {
    const rows = await db.update(groups).set(updateValues).where(whereCond).returning();
    const updated = rows[0];
    if (!updated) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
    }
    return updated as Group;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const deleteGroup = async (id: string, auth: AuthContext): Promise<{ id: string }> => {
  assertUuidParam(id);

  const conditions: any[] = [eq(groups.id, id), eq(groups.status, "active")];
  if (!isSuperAdmin(auth.role)) {
    conditions.push(eq(groups.companyId, auth.companyId));
  }

  const whereCond = and(...conditions);

  const rows = await db
    .update(groups)
    .set({
      status: "deleted",
      deletedBy: auth.userId,
      deletedAt: new Date(),
      updatedAt: new Date()
    })
    .where(whereCond)
    .returning({ id: groups.id });

  const deleted = rows[0];
  if (!deleted) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return { id: deleted.id };
};
