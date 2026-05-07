import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies, subscriptionPlans, subscriptions } from "db/schema";
import { AuthContext } from "types/common.types";
import {
  CreateSubscriptionPayload,
  Subscription,
  UpdateSubscriptionPayload,
  validStatuses
} from "types/subscriptions.types";
import { ApiError } from "utils/api-error.utils";
import {
  isSuperAdmin,
  requireAdmin,
  requireSuperAdmin,
  validateRequiredFields
} from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

const mapSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    status: subscriptions.status,
    planAmount: subscriptions.planAmount,
    netAmount: subscriptions.netAmount,
    startDate: subscriptions.startDate,
    endDate: subscriptions.endDate,
    createdAt: subscriptions.createdAt,
    updatedAt: subscriptions.updatedAt
  };
  return sortMap[sortBy] ?? subscriptions.createdAt;
};

export const createSubscription = async (
  payload: CreateSubscriptionPayload,
  auth: AuthContext
): Promise<Subscription> => {
  requireAdmin(auth);

  validateRequiredFields(payload, ["planId"]);

  assertUuidParam(payload.planId);

  const planRows = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, payload.planId), eq(subscriptionPlans.isActive, true)))
    .limit(1);

  const plan = planRows[0];
  if (!plan) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Subscription plan not found or inactive");
  }

  const discount = payload.discount ?? 0;
  const netAmount = Number(plan.amount) - Number(discount);

  const endDate = new Date();

  switch (plan.interval) {
    case "weekly":
      endDate.setDate(endDate.getDate() + 7);
      break;

    case "monthly":
      endDate.setMonth(endDate.getMonth() + 1);
      break;

    case "yearly":
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;

    default:
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Invalid plan interval");
  }

  const rows = await db
    .insert(subscriptions)
    .values({
      companyId: auth.companyId,
      planId: payload.planId,
      status: payload.status ?? "draft",
      planName: plan.name,
      planCode: plan.code,
      planDescription: plan.description ?? undefined,
      planInterval: plan.interval,
      planFeatures: plan.features,
      planAmount: plan.amount,
      planPlatformAmount: plan.platformAmount,
      planMessageAmount: plan.messageAmount,
      currency: plan.currency,
      discount,
      netAmount,
      startDate: payload.startDate ? new Date(payload.startDate) : new Date(),
      endDate
    })
    .returning();

  const created = rows[0];

  if (!created) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
    );
  }

  await db
    .update(companies)
    .set({
      messageCredits: sql`${companies.messageCredits} + ${plan.messageAmount}`
    })
    .where(eq(companies.id, auth.companyId));

  return created;
};

export const getSubscriptionById = async (id: string, auth: AuthContext): Promise<Subscription> => {
  assertUuidParam(id);

  const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);

  const subscription = rows[0];
  if (!subscription) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);

  if (!isSuperAdmin(auth.role) && subscription.companyId !== auth.companyId) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return subscription;
};

export const listSubscriptions = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: Subscription[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: [
      "status",
      "planAmount",
      "netAmount",
      "startDate",
      "endDate",
      "createdAt",
      "updatedAt"
    ],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const baseConditions: any[] = [];

  const companyIdFilter = typeof query.companyId === "string" ? query.companyId.trim() : "";
  if (!isSuperAdmin(auth.role)) {
    baseConditions.push(eq(subscriptions.companyId, auth.companyId));
  } else if (companyIdFilter.length > 0) {
    assertUuidParam(companyIdFilter);
    baseConditions.push(eq(subscriptions.companyId, companyIdFilter));
  }

  const statusFilter = typeof query.status === "string" ? query.status.trim() : "";
  if (statusFilter.length > 0) {
    if (!validStatuses.includes(statusFilter as any)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid status, must be one of: ${validStatuses.join(", ")}`
      );
    }
    baseConditions.push(eq(subscriptions.status, statusFilter as (typeof validStatuses)[number]));
  }

  if (q) {
    baseConditions.push(ilike(subscriptions.planName, `%${q}%`));
  }

  const whereCond = baseConditions.length > 0 ? and(...baseConditions) : undefined;

  const [countRows, items] = await Promise.all([
    db
      .select({
        total: count(subscriptions.id)
      })
      .from(subscriptions)
      .where(whereCond),

    db.select().from(subscriptions).where(whereCond).limit(limit).offset(offset).orderBy(orderBy)
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return buildListResponse({
    items: items as Subscription[],
    page,
    limit,
    total
  });
};

export const updateSubscription = async (
  id: string,
  payload: UpdateSubscriptionPayload,
  auth: AuthContext
): Promise<Subscription> => {
  requireSuperAdmin(auth);
  assertUuidParam(id);

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (payload.status !== undefined) updateValues.status = payload.status;

  if (payload.startDate !== undefined) updateValues.startDate = new Date(payload.startDate);
  if (payload.endDate !== undefined) updateValues.endDate = new Date(payload.endDate);

  const rows = await db
    .update(subscriptions)
    .set(updateValues)
    .where(eq(subscriptions.id, id))
    .returning();

  const updated = rows[0];
  if (!updated) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  return updated;
};

export const deleteSubscription = async (
  id: string,
  auth: AuthContext
): Promise<{ id: string }> => {
  requireSuperAdmin(auth);
  assertUuidParam(id);

  const rows = await db
    .update(subscriptions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.status, "active")))
    .returning({ id: subscriptions.id });

  const deleted = rows[0];
  if (!deleted) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  return { id: deleted.id };
};
