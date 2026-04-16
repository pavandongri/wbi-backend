import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies, customerCompanyMappings, customers } from "db/schema";
import { AuthContext } from "types/common.types";
import {
  CreateCustomerPayload,
  Customer,
  customerSelect,
  UpdateCustomerPayload
} from "types/customers.types";
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
    name: customers.name,
    phone: customers.phone,
    email: customers.email,
    city: customers.city,
    createdAt: customers.createdAt,
    updatedAt: customers.updatedAt
  };
  return sortMap[sortBy] ?? customers.createdAt;
};

export const createCustomer = async (
  payload: CreateCustomerPayload,
  auth: AuthContext
): Promise<Customer> => {
  if (!payload?.companyId || !payload?.name || !payload?.phone) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  assertCompanyScope(auth, payload.companyId);

  const companyRows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, payload.companyId), eq(companies.status, "active")))
    .limit(1);

  if (!companyRows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  const customerInsert = {
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    city: payload.city,
    state: payload.state,
    country: payload.country,
    zipcode: payload.zipcode,
    address: payload.address,
    tags: payload.tags,
    isActive: true
  };

  try {
    const customerRows = await db.insert(customers).values(customerInsert).returning();
    const createdCustomer = customerRows[0];
    if (!createdCustomer) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
      );
    }

    await db
      .insert(customerCompanyMappings)
      .values({
        customerId: createdCustomer.id,
        companyId: payload.companyId
      })
      .returning()
      .then(() => undefined);

    return createdCustomer;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const getCustomerById = async (id: string, auth: AuthContext): Promise<Customer> => {
  assertUuidParam(id);

  if (!isSuperAdmin(auth.role)) {
    await ensureCustomerMappedToCompany(id, auth.companyId);
  }

  const rows = await db
    .select(customerSelect)
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.isActive, true)))
    .limit(1);

  const customer = rows[0];
  if (!customer) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return customer as Customer;
};

export const listCustomers = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: Customer[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["name", "phone", "email", "city", "createdAt", "updatedAt"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const companyIdFilter = typeof query.companyId === "string" ? query.companyId.trim() : "";

  const useCompanyJoin = auth.role !== "super_admin" || companyIdFilter.length > 0;

  const baseCustomerConditions: any[] = [eq(customers.isActive, true)];
  if (!useCompanyJoin) {
    // super_admin without company filter can see all active customers.
    if (q) {
      baseCustomerConditions.push(
        or(
          ilike(customers.name, `%${q}%`),
          ilike(customers.phone, `%${q}%`),
          ilike(customers.email, `%${q}%`)
        )
      );
    }
    const whereCond = and(...baseCustomerConditions);
    const countRows = await db
      .select({ total: count(customers.id) })
      .from(customers)
      .where(whereCond);
    const total = Number(countRows[0]?.total ?? 0);

    const itemsRows = await db
      .select(customerSelect)
      .from(customers)
      .where(whereCond)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy);

    return buildListResponse({ items: itemsRows as Customer[], page, limit, total });
  }

  const scopedCompanyId = auth.role !== "super_admin" ? auth.companyId : companyIdFilter;
  if (!scopedCompanyId) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  const baseJoinConditions: any[] = [
    eq(customerCompanyMappings.companyId, scopedCompanyId),
    eq(customers.isActive, true)
  ];

  if (q) {
    baseJoinConditions.push(
      or(
        ilike(customers.name, `%${q}%`),
        ilike(customers.phone, `%${q}%`),
        ilike(customers.email, `%${q}%`)
      )
    );
  }

  const whereCond = and(...baseJoinConditions);

  const countRows = await db
    .select({ total: count(customers.id) })
    .from(customerCompanyMappings)
    .innerJoin(customers, eq(customerCompanyMappings.customerId, customers.id))
    .where(whereCond);
  const total = Number(countRows[0]?.total ?? 0);

  const itemsRows = await db
    .select(customerSelect)
    .from(customerCompanyMappings)
    .innerJoin(customers, eq(customerCompanyMappings.customerId, customers.id))
    .where(whereCond)
    .limit(limit)
    .offset(offset)
    .orderBy(orderBy);

  return buildListResponse({ items: itemsRows as Customer[], page, limit, total });
};

export const updateCustomer = async (
  id: string,
  payload: UpdateCustomerPayload,
  auth: AuthContext
): Promise<Customer> => {
  assertUuidParam(id);

  if (payload.isActive !== undefined && payload.isActive !== true) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  if (!isSuperAdmin(auth.role)) {
    await ensureCustomerMappedToCompany(id, auth.companyId);
  }

  const updateConditions: any[] = [eq(customers.id, id), eq(customers.isActive, true)];
  const whereCond = and(...updateConditions);

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.name !== undefined) updateValues.name = payload.name;
  if (payload.phone !== undefined) updateValues.phone = payload.phone;
  if (payload.email !== undefined) updateValues.email = payload.email;
  if (payload.city !== undefined) updateValues.city = payload.city;
  if (payload.state !== undefined) updateValues.state = payload.state;
  if (payload.country !== undefined) updateValues.country = payload.country;
  if (payload.zipcode !== undefined) updateValues.zipcode = payload.zipcode;
  if (payload.address !== undefined) updateValues.address = payload.address;
  if (payload.tags !== undefined) updateValues.tags = payload.tags;

  try {
    const rows = await db.update(customers).set(updateValues).where(whereCond).returning();
    const updated = rows[0];
    if (!updated) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
    }
    return updated as Customer;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const deleteCustomer = async (id: string, auth: AuthContext): Promise<{ id: string }> => {
  assertUuidParam(id);

  if (auth.role !== "super_admin") {
    await ensureCustomerMappedToCompany(id, auth.companyId);
  }

  const rows = await db
    .update(customers)
    .set({
      isActive: false,
      updatedAt: new Date()
    })
    .where(and(eq(customers.id, id), eq(customers.isActive, true)))
    .returning({ id: customers.id });

  const deleted = rows[0];
  if (!deleted) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return { id: deleted.id };
};
