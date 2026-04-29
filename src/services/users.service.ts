import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";

import { ROLES } from "constants/common.constants";
import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { users } from "db/schema";
import { AuthContext } from "types/common.types";
import { CreateUserPayload, UpdateUserPayload, User } from "types/users.types";
import { ApiError } from "utils/api-error.utils";
import {
  getMissingFields,
  handleUniqueViolation,
  hashPassword,
  isAdminOrHigher,
  isSuperAdmin
} from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

const validUserRoles = new Set(Object.values(ROLES));

const mapSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    name: users.name,
    email: users.email,
    phone: users.phone,
    role: users.role,
    status: users.status,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt
  };
  return sortMap[sortBy] ?? users.createdAt;
};

// used to create super-admin , admin
export const createUser = async (payload: CreateUserPayload, auth: AuthContext): Promise<User> => {
  if (!isAdminOrHigher(auth.role)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Only admins can create users");
  }

  const missingInputs = getMissingFields(payload, ["name", "role", "email", "phone", "password"]);

  if (missingInputs.length > 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `missing [${missingInputs.join(", ")}]`);
  }

  const passwordHash = await hashPassword(payload.password);

  const insertValues = {
    companyId: auth.companyId,
    name: payload.name,
    role: payload.role,
    email: payload.email,
    password: passwordHash,
    phone: payload.phone ?? "",
    status: "active" as const,
    createdBy: auth.userId
  };

  const existing = await db.query.users.findFirst({
    where: (u, { or, eq }) => or(eq(u.email, payload.email), eq(u.phone, payload.phone ?? ""))
  });

  if (existing && existing.email === payload.email) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "Email already in use");
  }

  if (existing && existing.phone === payload.phone) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "Phone number already in use");
  }

  try {
    const rows = await db.insert(users).values(insertValues).returning();
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

export const getUserById = async (id: string, auth: AuthContext): Promise<User> => {
  assertUuidParam(id);

  const conditions: any[] = [eq(users.id, id), eq(users.status, "active")];
  if (!isSuperAdmin(auth.role)) {
    conditions.push(eq(users.companyId, auth.companyId));
  }

  const whereCond = and(...conditions);

  const rows = await db.select().from(users).where(whereCond).limit(1);
  const user = rows[0];
  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return user;
};

export const listUsers = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{ items: User[]; page: number; limit: number; total: number; totalPages: number }> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["name", "email", "phone", "role", "status", "createdAt", "updatedAt"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const baseConditions: any[] = [eq(users.status, "active")];
  if (!isSuperAdmin(auth.role)) {
    baseConditions.push(eq(users.companyId, auth.companyId));
  }

  const roleFilter = typeof query.role === "string" ? query.role.trim() : "";

  if (roleFilter.length > 0) {
    if (!validUserRoles.has(roleFilter as (typeof ROLES)[keyof typeof ROLES])) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid role filter, must be one of: ${Object.values(ROLES).join(", ")}`
      );
    }
    const roleValue = roleFilter as "super_admin" | "admin" | "staff";
    baseConditions.push(eq(users.role, roleValue));
  }

  if (q) {
    baseConditions.push(
      or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.phone, `%${q}%`))
    );
  }

  const whereCond = and(...baseConditions);

  const countRows = await db
    .select({ total: count(users.id) })
    .from(users)
    .where(whereCond);
  const total = Number(countRows[0]?.total ?? 0);

  const itemsRows = await db
    .select()
    .from(users)
    .where(whereCond)
    .limit(limit)
    .offset(offset)
    .orderBy(orderBy);

  return buildListResponse({ items: itemsRows as User[], page, limit, total });
};

export const updateUser = async (
  id: string,
  payload: UpdateUserPayload,
  auth: AuthContext
): Promise<User> => {
  assertUuidParam(id);

  if (payload.status && payload.status !== "active") {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      "User status cannot be set to inactive via this endpoint"
    );
  }

  const conditions: any[] = [eq(users.id, id), eq(users.status, "active")];
  if (!isSuperAdmin(auth.role)) {
    conditions.push(eq(users.companyId, auth.companyId));
  }

  const whereCond = and(...conditions);

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (payload.name !== undefined) updateValues.name = payload.name;
  if (payload.email !== undefined) updateValues.email = payload.email;
  if (payload.phone !== undefined) updateValues.phone = payload.phone;

  if (payload.role !== undefined) {
    if (!validUserRoles.has(payload.role)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid role, must be one of: ${Object.values(ROLES).join(", ")}`
      );
    }

    if (!isSuperAdmin(auth.role) && isSuperAdmin(payload.role)) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        "Only super admins can assign the super_admin role"
      );
    }

    updateValues.role = payload.role;
  }

  if (payload.password !== undefined) {
    updateValues.password = await hashPassword(payload.password);
  }

  // ✅ Uniqueness check ONLY for fields being updated
  if (payload.email !== undefined || payload.phone !== undefined) {
    const existing = await db.query.users.findFirst({
      where: (u, { or, eq, ne }) =>
        or(
          payload.email ? eq(u.email, payload.email) : undefined,
          payload.phone ? eq(u.phone, payload.phone) : undefined
        )
    });

    if (existing && existing.id !== id) {
      if (payload.email && existing.email === payload.email) {
        throw new ApiError(HTTP_STATUS.CONFLICT, "Email already in use");
      }

      if (payload.phone && existing.phone === payload.phone) {
        throw new ApiError(HTTP_STATUS.CONFLICT, "Phone number already in use");
      }
    }
  }

  try {
    const rows = await db.update(users).set(updateValues).where(whereCond).returning();

    const updated = rows[0];

    if (!updated) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
    }

    return updated as User;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const deleteUser = async (id: string, auth: AuthContext): Promise<{ id: string }> => {
  assertUuidParam(id);

  const conditions: any[] = [eq(users.id, id), eq(users.status, "active")];
  if (!isSuperAdmin(auth.role)) {
    conditions.push(eq(users.companyId, auth.companyId));
  }
  const whereCond = and(...conditions);

  const rows = await db
    .update(users)
    .set({
      status: "deleted",
      deletedBy: auth.userId,
      deletedAt: new Date(),
      updatedAt: new Date()
    })
    .where(whereCond)
    .returning({ id: users.id });

  const deleted = rows[0];
  if (!deleted) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return { id: deleted.id };
};
