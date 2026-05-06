import { and, asc, count, desc, eq, ilike, or, SQL } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { subscriptionPlans } from "db/schema";
import { AuthContext } from "types/common.types";
import {
  CreateSubscriptionPlanPayload,
  SubscriptionPlan,
  UpdateSubscriptionPlanPayload
} from "types/subscription-plans.types";
import { ApiError } from "utils/api-error.utils";
import { handleUniqueViolation, requireSuperAdmin, validateRequiredFields } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

const mapSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    name: subscriptionPlans.name,
    code: subscriptionPlans.code,
    amount: subscriptionPlans.amount,
    interval: subscriptionPlans.interval,
    isActive: subscriptionPlans.isActive,
    createdAt: subscriptionPlans.createdAt,
    updatedAt: subscriptionPlans.updatedAt
  };
  return sortMap[sortBy] ?? subscriptionPlans.createdAt;
};

export const createSubscriptionPlan = async (
  payload: CreateSubscriptionPlanPayload,
  auth: AuthContext
): Promise<SubscriptionPlan> => {
  requireSuperAdmin(auth);

  validateRequiredFields(payload, [
    "name",
    "code",
    "amount",
    "platformAmount",
    "messageAmount",
    "interval"
  ]);

  try {
    const rows = await db
      .insert(subscriptionPlans)
      .values({
        name: payload.name,
        code: payload.code,
        description: payload.description,
        amount: payload.amount,
        platformAmount: payload.platformAmount,
        messageAmount: payload.messageAmount,
        currency: payload.currency ?? "INR",
        interval: payload.interval,
        features: payload.features,
        isActive: true
      })
      .returning();

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

export const getSubscriptionPlanById = async (
  id: string,
  auth: AuthContext
): Promise<SubscriptionPlan> => {
  assertUuidParam(id);

  const rows = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, id))
    .limit(1);

  const plan = rows[0];

  if (!plan) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);

  return plan;
};

export const listSubscriptionPlans = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: SubscriptionPlan[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["name", "code", "amount", "interval", "isActive", "createdAt", "updatedAt"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const baseConditions: SQL[] = [eq(subscriptionPlans.isActive, true)];

  if (q) {
    const searchCondition = or(
      ilike(subscriptionPlans.name, `%${q}%`),
      ilike(subscriptionPlans.code, `%${q}%`)
    );

    if (searchCondition) {
      baseConditions.push(searchCondition);
    }
  }

  const whereCond = baseConditions.length > 0 ? and(...baseConditions) : undefined;

  const [countRows, items] = await Promise.all([
    db
      .select({ total: count(subscriptionPlans.id) })
      .from(subscriptionPlans)
      .where(whereCond),

    db
      .select()
      .from(subscriptionPlans)
      .where(whereCond)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy)
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return buildListResponse({
    items: items as SubscriptionPlan[],
    page,
    limit,
    total
  });
};

export const updateSubscriptionPlan = async (
  id: string,
  payload: UpdateSubscriptionPlanPayload,
  auth: AuthContext
): Promise<SubscriptionPlan> => {
  assertUuidParam(id);

  requireSuperAdmin(auth);

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.name !== undefined) updateValues.name = payload.name;
  if (payload.code !== undefined) updateValues.code = payload.code;
  if (payload.description !== undefined) updateValues.description = payload.description;
  if (payload.amount !== undefined) updateValues.amount = payload.amount;
  if (payload.platformAmount !== undefined) updateValues.platformAmount = payload.platformAmount;
  if (payload.messageAmount !== undefined) updateValues.messageAmount = payload.messageAmount;
  if (payload.currency !== undefined) updateValues.currency = payload.currency;
  if (payload.interval !== undefined) updateValues.interval = payload.interval;
  if (payload.features !== undefined) updateValues.features = payload.features;
  if (payload.isActive !== undefined) updateValues.isActive = payload.isActive;

  try {
    const rows = await db
      .update(subscriptionPlans)
      .set(updateValues)
      .where(eq(subscriptionPlans.id, id))
      .returning();

    const updated = rows[0];
    if (!updated) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
    return updated;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const deleteSubscriptionPlan = async (
  id: string,
  auth: AuthContext
): Promise<{ id: string }> => {
  assertUuidParam(id);

  requireSuperAdmin(auth);

  const rows = await db
    .update(subscriptionPlans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.isActive, true)))
    .returning({ id: subscriptionPlans.id });

  const deleted = rows[0];

  if (!deleted) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);

  return { id: deleted.id };
};
