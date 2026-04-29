import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies } from "db/schema";
import { AuthContext } from "types/common.types";
import {
  Company,
  CreateCompanyPayload,
  mapSortByToColumn,
  UpdateCompanyPayload
} from "types/company.types";
import { ApiError } from "utils/api-error.utils";
import { handleUniqueViolation, isSuperAdmin } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

export const createCompany = async (
  payload: CreateCompanyPayload,
  auth: AuthContext
): Promise<Company> => {
  if (!isSuperAdmin(auth.role)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Only super admins can create companies");
  }

  if (!payload?.name || !payload?.phone) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "name and phone are required");
  }

  const insertValues = {
    name: payload.name,
    phone: payload.phone,
    status: "active" as const,
    category: payload.category,
    address: payload.address,
    city: payload.city,
    state: payload.state,
    country: payload.country,
    zipcode: payload.zipcode,
    email: payload.email
  };

  try {
    const [company] = await db.insert(companies).values(insertValues).returning();

    if (!company) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
      );
    }
    return company;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const getCompanyById = async (id: string, auth: AuthContext): Promise<Company> => {
  assertUuidParam(id);

  const conditions = [eq(companies.id, id), eq(companies.status, "active")];

  if (auth.role !== "super_admin") {
    conditions.push(eq(companies.id, auth.companyId));
  }

  const whereCond = and(...(conditions as any));

  const [company] = await db.select().from(companies).where(whereCond).limit(1);

  if (!company) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return company;
};

export const listCompanies = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: Company[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["name", "phone", "email", "category", "status", "createdAt", "updatedAt"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const baseConditions: any[] = [eq(companies.status, "active")];
  if (auth.role !== "super_admin") {
    baseConditions.push(eq(companies.id, auth.companyId));
  }

  if (q) {
    baseConditions.push(
      or(
        ilike(companies.name, `%${q}%`),
        ilike(companies.phone, `%${q}%`),
        ilike(companies.email, `%${q}%`)
      )
    );
  }

  if (typeof query.category === "string" && query.category.trim().length > 0) {
    baseConditions.push(eq(companies.category, query.category.trim()));
  }

  const whereCond = and(...baseConditions);

  const countRows = await db
    .select({ total: count(companies.id) })
    .from(companies)
    .where(whereCond);

  const total = Number(countRows[0]?.total ?? 0);

  const itemsRows = await db
    .select()
    .from(companies)
    .where(whereCond)
    .limit(limit)
    .offset(offset)
    .orderBy(orderBy);

  return buildListResponse({ items: itemsRows as Company[], page, limit, total });
};

export const updateCompany = async (
  id: string,
  payload: UpdateCompanyPayload,
  auth: AuthContext
): Promise<Company> => {
  assertUuidParam(id);

  const conditions: any[] = [eq(companies.id, id), eq(companies.status, "active")];

  if (auth.role !== "super_admin") {
    conditions.push(eq(companies.id, auth.companyId));
  }

  const whereCond = and(...conditions);

  if (payload.status && payload.status !== "active") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date()
  };

  if (payload.name !== undefined) updateValues.name = payload.name;
  if (payload.phone !== undefined) updateValues.phone = payload.phone;
  if (payload.email !== undefined) updateValues.email = payload.email;
  if (payload.category !== undefined) updateValues.category = payload.category;
  if (payload.address !== undefined) updateValues.address = payload.address;
  if (payload.city !== undefined) updateValues.city = payload.city;
  if (payload.state !== undefined) updateValues.state = payload.state;
  if (payload.country !== undefined) updateValues.country = payload.country;
  if (payload.zipcode !== undefined) updateValues.zipcode = payload.zipcode;

  try {
    const [updated] = await db.update(companies).set(updateValues).where(whereCond).returning();
    if (!updated) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
    }
    return updated as Company;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const deleteCompany = async (id: string, auth: AuthContext): Promise<{ id: string }> => {
  assertUuidParam(id);

  const conditions: any[] = [eq(companies.id, id), eq(companies.status, "active")];

  if (auth.role !== "super_admin") {
    conditions.push(eq(companies.id, auth.companyId));
  }

  const whereCond = and(...conditions);

  const [updated] = await db
    .update(companies)
    .set({
      status: "deleted",
      updatedAt: new Date()
    })
    .where(whereCond)
    .returning({ id: companies.id });

  if (!updated) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return { id: updated.id };
};
