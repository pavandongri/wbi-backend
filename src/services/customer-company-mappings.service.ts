import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies, customerCompanyMappings, customers } from "db/schema";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { AuthContext } from "types/common.types";
import {
  CreateCustomerCompanyMappingPayload,
  customerCompanyMapping,
  customerCompanyMappingmapSortByToColumn,
  customerCompanyMappingSelect,
  UpdateCustomerCompanyMappingPayload
} from "types/customer-company-mappings.types";
import { ApiError } from "utils/api-error.utils";
import { assertCompanyScope, handleUniqueViolation } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

export const createCustomerCompanyMapping = async (
  payload: CreateCustomerCompanyMappingPayload,
  auth: AuthContext
): Promise<customerCompanyMapping> => {
  assertUuidParam(payload.customerId);
  assertUuidParam(payload.companyId);
  assertCompanyScope(auth, payload.companyId);

  const customerRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, payload.customerId), eq(customers.isActive, true)))
    .limit(1);

  if (!customerRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
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
    customerId: payload.customerId,
    companyId: payload.companyId
  };

  try {
    const rows = await db
      .insert(customerCompanyMappings)
      .values(insertValues)
      .returning(customerCompanyMappingSelect);

    const created = rows[0];

    if (!created) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
      );
    }

    return created as customerCompanyMapping;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const getCustomerCompanyMappingById = async (
  id: string,
  auth: AuthContext
): Promise<customerCompanyMapping> => {
  assertUuidParam(id);

  const conditions: any[] = [
    eq(customerCompanyMappings.id, id),
    eq(customers.isActive, true),
    eq(companies.status, "active")
  ];

  if (auth.role !== "super_admin") {
    conditions.push(eq(customerCompanyMappings.companyId, auth.companyId));
  }

  const whereCond = and(...conditions);

  const rows = await db
    .select(customerCompanyMappingSelect)
    .from(customerCompanyMappings)
    .innerJoin(customers, eq(customerCompanyMappings.customerId, customers.id))
    .innerJoin(companies, eq(customerCompanyMappings.companyId, companies.id))
    .where(whereCond)
    .limit(1);

  const customerCompanyMapping = rows[0];
  if (!customerCompanyMapping) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return customerCompanyMapping as customerCompanyMapping;
};

export const listCustomerCompanyMappings = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: customerCompanyMapping[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["createdAt", "customerId", "companyId"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = customerCompanyMappingmapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const customerIdFilter = typeof query.customerId === "string" ? query.customerId.trim() : "";
  if (customerIdFilter.length > 0) assertUuidParam(customerIdFilter);

  const companyIdFilter = typeof query.companyId === "string" ? query.companyId.trim() : "";
  const scopedCompanyId = auth.role !== "super_admin" ? auth.companyId : companyIdFilter;
  if (auth.role !== "super_admin") {
    assertCompanyScope(auth, scopedCompanyId);
  }

  const baseConditions: any[] = [eq(customers.isActive, true), eq(companies.status, "active")];

  if (scopedCompanyId) baseConditions.push(eq(customerCompanyMappings.companyId, scopedCompanyId));
  if (customerIdFilter)
    baseConditions.push(eq(customerCompanyMappings.customerId, customerIdFilter));

  if (q) {
    baseConditions.push(
      or(
        ilike(customers.name, `%${q}%`),
        ilike(customers.phone, `%${q}%`),
        ilike(customers.email, `%${q}%`)
      )
    );
  }

  const whereCond = and(...baseConditions);

  const countRows = await db
    .select({ total: count(customerCompanyMappings.id) })
    .from(customerCompanyMappings)
    .innerJoin(customers, eq(customerCompanyMappings.customerId, customers.id))
    .innerJoin(companies, eq(customerCompanyMappings.companyId, companies.id))
    .where(whereCond);
  const total = Number(countRows[0]?.total ?? 0);

  const itemsRows = await db
    .select(customerCompanyMappingSelect)
    .from(customerCompanyMappings)
    .innerJoin(customers, eq(customerCompanyMappings.customerId, customers.id))
    .innerJoin(companies, eq(customerCompanyMappings.companyId, companies.id))
    .where(whereCond)
    .limit(limit)
    .offset(offset)
    .orderBy(orderBy);

  return buildListResponse({ items: itemsRows as customerCompanyMapping[], page, limit, total });
};

export const updateCustomerCompanyMapping = async (
  id: string,
  payload: UpdateCustomerCompanyMappingPayload,
  auth: AuthContext
): Promise<customerCompanyMapping> => {
  assertUuidParam(id);

  const existing = await getCustomerCompanyMappingById(id, auth);

  const nextCustomerId = payload.customerId ?? existing.customerId;
  const nextCompanyId = payload.companyId ?? existing.companyId;

  assertUuidParam(nextCustomerId);
  assertUuidParam(nextCompanyId);
  assertCompanyScope(auth, nextCompanyId);

  // Validate referenced entities are active.
  const customerRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, nextCustomerId), eq(customers.isActive, true)))
    .limit(1);
  if (!customerRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  const companyRows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, nextCompanyId), eq(companies.status, "active")))
    .limit(1);
  if (!companyRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  try {
    const rows = await db
      .update(customerCompanyMappings)
      .set({
        customerId: nextCustomerId,
        companyId: nextCompanyId
      })
      .where(and(eq(customerCompanyMappings.id, id)))
      .returning(customerCompanyMappingSelect);

    const updated = rows[0];
    if (!updated) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
    }

    return updated as customerCompanyMapping;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const deleteCustomerCompanyMapping = async (
  id: string,
  auth: AuthContext
): Promise<{ id: string }> => {
  assertUuidParam(id);

  const whereCond: any[] = [eq(customerCompanyMappings.id, id)];
  if (auth.role !== "super_admin") {
    whereCond.push(eq(customerCompanyMappings.companyId, auth.companyId));
  }

  const rows = await db
    .delete(customerCompanyMappings)
    .where(and(...whereCond))
    .returning({ id: customerCompanyMappings.id });

  const deleted = rows[0];
  if (!deleted) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return { id: deleted.id };
};
