import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies, customerGroupMappings, customers, groups } from "db/schema";
import { AuthContext } from "types/common.types";
import {
  CreateCustomerGroupMappingPayload,
  customerGroupMapping,
  customerGroupMappingSelect,
  UpdateCustomerGroupMappingPayload
} from "types/customer-group-mappings.types";
import { ApiError } from "utils/api-error.utils";
import {
  assertCompanyScope,
  ensureCustomerMappedToCompany,
  handleUniqueViolation,
  isSuperAdmin
} from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

const mapSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    createdAt: customerGroupMappings.createdAt,
    customerId: customerGroupMappings.customerId,
    groupId: customerGroupMappings.groupId
  };
  return sortMap[sortBy] ?? customerGroupMappings.createdAt;
};

export const createCustomerGroupMapping = async (
  payload: CreateCustomerGroupMappingPayload,
  auth: AuthContext
): Promise<customerGroupMapping> => {
  assertUuidParam(payload.customerId);
  assertUuidParam(payload.groupId);

  // Validate referenced objects are active and determine group company.
  const groupRows = await db
    .select({ id: groups.id, companyId: groups.companyId })
    .from(groups)
    .where(and(eq(groups.id, payload.groupId), eq(groups.status, "active")))
    .limit(1);

  if (!groupRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  const groupCompanyId = groupRows[0].companyId;
  assertCompanyScope(auth, groupCompanyId);

  const customerRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, payload.customerId), eq(customers.isActive, true)))
    .limit(1);
  if (!customerRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  await ensureCustomerMappedToCompany(payload.customerId, groupCompanyId);

  const insertValues = {
    customerId: payload.customerId,
    groupId: payload.groupId
  };

  try {
    const rows = await db
      .insert(customerGroupMappings)
      .values(insertValues)
      .returning(customerGroupMappingSelect);
    const created = rows[0];
    if (!created) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
      );
    }
    return created as customerGroupMapping;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const createCustomerGroupMappings = async (
  payloads: CreateCustomerGroupMappingPayload[],
  auth: AuthContext
): Promise<customerGroupMapping[]> => {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  return Promise.all(payloads.map((payload) => createCustomerGroupMapping(payload, auth)));
};

export const getCustomerGroupMappingById = async (
  id: string,
  auth: AuthContext
): Promise<customerGroupMapping> => {
  assertUuidParam(id);

  const conditions: any[] = [
    eq(customerGroupMappings.id, id),
    eq(customers.isActive, true),
    eq(groups.status, "active"),
    eq(companies.status, "active")
  ];

  if (auth.role !== "super_admin") {
    conditions.push(eq(groups.companyId, auth.companyId));
  }

  const whereCond = and(...conditions);

  const rows = await db
    .select(customerGroupMappingSelect)
    .from(customerGroupMappings)
    .innerJoin(customers, eq(customerGroupMappings.customerId, customers.id))
    .innerJoin(groups, eq(customerGroupMappings.groupId, groups.id))
    .innerJoin(companies, eq(groups.companyId, companies.id))
    .where(whereCond)
    .limit(1);

  const customerGroupMapping = rows[0];
  if (!customerGroupMapping) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return customerGroupMapping as customerGroupMapping;
};

export const listCustomerGroupMappings = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: customerGroupMapping[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["createdAt", "customerId", "groupId"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const customerIdFilter = typeof query.customerId === "string" ? query.customerId.trim() : "";
  if (customerIdFilter.length > 0) assertUuidParam(customerIdFilter);

  const groupIdFilter = typeof query.groupId === "string" ? query.groupId.trim() : "";
  if (groupIdFilter.length > 0) assertUuidParam(groupIdFilter);

  const baseConditions: any[] = [
    eq(customers.isActive, true),
    eq(groups.status, "active"),
    eq(companies.status, "active")
  ];

  if (!isSuperAdmin(auth.role)) {
    baseConditions.push(eq(groups.companyId, auth.companyId));
  }

  if (customerIdFilter) baseConditions.push(eq(customerGroupMappings.customerId, customerIdFilter));
  if (groupIdFilter) baseConditions.push(eq(customerGroupMappings.groupId, groupIdFilter));

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
    .select({ total: count(customerGroupMappings.id) })
    .from(customerGroupMappings)
    .innerJoin(customers, eq(customerGroupMappings.customerId, customers.id))
    .innerJoin(groups, eq(customerGroupMappings.groupId, groups.id))
    .innerJoin(companies, eq(groups.companyId, companies.id))
    .where(whereCond);
  const total = Number(countRows[0]?.total ?? 0);

  const itemsRows = await db
    .select(customerGroupMappingSelect)
    .from(customerGroupMappings)
    .innerJoin(customers, eq(customerGroupMappings.customerId, customers.id))
    .innerJoin(groups, eq(customerGroupMappings.groupId, groups.id))
    .innerJoin(companies, eq(groups.companyId, companies.id))
    .where(whereCond)
    .limit(limit)
    .offset(offset)
    .orderBy(orderBy);

  return buildListResponse({ items: itemsRows as customerGroupMapping[], page, limit, total });
};

export const updateCustomerGroupMapping = async (
  id: string,
  payload: UpdateCustomerGroupMappingPayload,
  auth: AuthContext
): Promise<customerGroupMapping> => {
  assertUuidParam(id);

  const existing = await getCustomerGroupMappingById(id, auth);
  const nextCustomerId = payload.customerId ?? existing.customerId;
  const nextGroupId = payload.groupId ?? existing.groupId;

  assertUuidParam(nextCustomerId);
  assertUuidParam(nextGroupId);

  // Validate next group + company.
  const groupRows = await db
    .select({ id: groups.id, companyId: groups.companyId })
    .from(groups)
    .where(and(eq(groups.id, nextGroupId), eq(groups.status, "active")))
    .limit(1);
  if (!groupRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  const groupCompanyId = groupRows[0].companyId;
  assertCompanyScope(auth, groupCompanyId);

  const companyRows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, groupCompanyId), eq(companies.status, "active")))
    .limit(1);
  if (!companyRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  const customerRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, nextCustomerId), eq(customers.isActive, true)))
    .limit(1);
  if (!customerRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  await ensureCustomerMappedToCompany(nextCustomerId, groupCompanyId);

  try {
    const rows = await db
      .update(customerGroupMappings)
      .set({
        customerId: nextCustomerId,
        groupId: nextGroupId
      })
      .where(eq(customerGroupMappings.id, id))
      .returning(customerGroupMappingSelect);

    const updated = rows[0];
    if (!updated) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
    }
    return updated as customerGroupMapping;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const deleteCustomerGroupMapping = async (
  id: string,
  auth: AuthContext
): Promise<{ id: string }> => {
  assertUuidParam(id);

  // Enforce tenant scoping (and also ensure the referenced rows are active).
  await getCustomerGroupMappingById(id, auth);

  const rows = await db
    .delete(customerGroupMappings)
    .where(eq(customerGroupMappings.id, id))
    .returning({ id: customerGroupMappings.id });

  const deleted = rows[0];
  if (!deleted) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return { id: deleted.id };
};
