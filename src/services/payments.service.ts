import { env } from "config/env";
import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import crypto from "crypto";
import { db } from "db/index";
import { payments, subscriptionPlans } from "db/schema";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { AuthContext } from "types/common.types";
import {
  CreateOrderPayload,
  Payment,
  RefundPaymentPayload,
  UpdatePaymentPayload,
  VerifyPaymentPayload,
  validPaymentStatuses,
  validPaymentTypes
} from "types/payments.types";
import { ApiError } from "utils/api-error.utils";
import { getRazorpay, handleUniqueViolation, isSuperAdmin, requireAdmin } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

const mapSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    amount: payments.amount,
    status: payments.status,
    type: payments.type,
    paidAt: payments.paidAt,
    createdAt: payments.createdAt,
    updatedAt: payments.updatedAt
  };
  return sortMap[sortBy] ?? payments.createdAt;
};

export const createOrder = async (
  payload: CreateOrderPayload,
  auth: AuthContext
): Promise<{ payment: Payment; order: Record<string, unknown> }> => {
  requireAdmin(auth);

  if (!payload.type || !validPaymentTypes.includes(payload.type)) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid type, must be one of: ${validPaymentTypes.join(", ")}`
    );
  }

  if (!payload.amount || payload.amount <= 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "amount must be a positive integer (in paise)");
  }

  if (payload.subscriptionPlanId) {
    const subscriptionPlanId: string = payload.subscriptionPlanId;
    assertUuidParam(subscriptionPlanId);

    const planRows = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(
        and(eq(subscriptionPlans.id, subscriptionPlanId), eq(subscriptionPlans.isActive, true))
      )
      .limit(1);

    if (!planRows[0]) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Subscription plan not found");
    }
  }

  const currency = payload.currency ?? "INR";
  const receipt = `rcpt_${Date.now()}`;

  const razorpay = getRazorpay();
  let order: any;
  try {
    order = await razorpay.orders.create({
      amount: Number(payload.amount) * 100,
      currency,
      receipt,
      notes: {
        companyId: auth.companyId,
        type: payload.type,
        subscriptionPlanId: payload.subscriptionPlanId ?? "",
        subscriptionId: payload.subscriptionId ?? "",
        userId: auth.userId
      }
    });
  } catch (err: any) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      err?.error?.description ?? "Failed to create Razorpay order"
    );
  }

  let payment: Payment;
  try {
    const rows = await db
      .insert(payments)
      .values({
        companyId: auth.companyId,
        subscriptionId: payload.subscriptionId ?? null,
        subscriptionPlanId: payload.subscriptionPlanId ?? null,
        type: payload.type,
        razorpayOrderId: order.id,
        amount: payload.amount,
        currency
      })
      .returning();

    payment = rows[0]!;
  } catch (err) {
    handleUniqueViolation(err);
  }

  return { payment: payment!, order };
};

export const verifyPayment = async (
  payload: VerifyPaymentPayload,
  auth: AuthContext
): Promise<Payment> => {
  if (!payload.razorpayOrderId || !payload.razorpayPaymentId || !payload.razorpaySignature) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      "razorpayOrderId, razorpayPaymentId and razorpaySignature are required"
    );
  }

  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayOrderId, payload.razorpayOrderId))
    .limit(1);

  const payment = rows[0];
  if (!payment) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);

  if (!isSuperAdmin(auth.role) && payment.companyId !== auth.companyId) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  if (payment.status === "captured") {
    throw new ApiError(HTTP_STATUS.CONFLICT, "Payment already verified");
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${payload.razorpayOrderId}|${payload.razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== payload.razorpaySignature) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Invalid payment signature");
  }

  const updated = await db
    .update(payments)
    .set({
      razorpayPaymentId: payload.razorpayPaymentId,
      razorpaySignature: payload.razorpaySignature,
      status: "captured",
      paidAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(payments.id, payment.id))
    .returning();

  return updated[0];
};

export const getPaymentById = async (id: string, auth: AuthContext): Promise<Payment> => {
  assertUuidParam(id);

  const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);

  const payment = rows[0];
  if (!payment) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);

  if (!isSuperAdmin(auth.role) && payment.companyId !== auth.companyId) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return payment;
};

export const listPayments = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: Payment[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["amount", "status", "type", "paidAt", "createdAt", "updatedAt"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const baseConditions: any[] = [];

  if (!isSuperAdmin(auth.role)) {
    baseConditions.push(eq(payments.companyId, auth.companyId));
  } else {
    const companyIdFilter = typeof query.companyId === "string" ? query.companyId.trim() : "";
    if (companyIdFilter.length > 0) {
      assertUuidParam(companyIdFilter);
      baseConditions.push(eq(payments.companyId, companyIdFilter));
    }
  }

  const typeFilter = typeof query.type === "string" ? query.type.trim() : "";
  if (typeFilter.length > 0) {
    if (!validPaymentTypes.includes(typeFilter as any)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid type, must be one of: ${validPaymentTypes.join(", ")}`
      );
    }
    baseConditions.push(eq(payments.type, typeFilter));
  }

  const statusFilter = typeof query.status === "string" ? query.status.trim() : "";
  if (statusFilter.length > 0) {
    if (!validPaymentStatuses.includes(statusFilter as any)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid status, must be one of: ${validPaymentStatuses.join(", ")}`
      );
    }
    baseConditions.push(eq(payments.status, statusFilter as (typeof validPaymentStatuses)[number]));
  }

  const subscriptionIdFilter =
    typeof query.subscriptionId === "string" ? query.subscriptionId.trim() : "";
  if (subscriptionIdFilter.length > 0) {
    assertUuidParam(subscriptionIdFilter);
    baseConditions.push(eq(payments.subscriptionId, subscriptionIdFilter));
  }

  const subscriptionPlanIdFilter =
    typeof query.subscriptionPlanId === "string" ? query.subscriptionPlanId.trim() : "";
  if (subscriptionPlanIdFilter.length > 0) {
    assertUuidParam(subscriptionPlanIdFilter);
    baseConditions.push(eq(payments.subscriptionPlanId, subscriptionPlanIdFilter));
  }

  const whereCond = baseConditions.length > 0 ? and(...baseConditions) : undefined;

  const [countRows, items] = await Promise.all([
    db
      .select({ total: count(payments.id) })
      .from(payments)
      .where(whereCond),
    db.select().from(payments).where(whereCond).limit(limit).offset(offset).orderBy(orderBy)
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return buildListResponse({ items: items as Payment[], page, limit, total });
};

export const updatePayment = async (
  id: string,
  payload: UpdatePaymentPayload,
  auth: AuthContext
): Promise<Payment> => {
  requireAdmin(auth);
  assertUuidParam(id);

  if (payload.status !== undefined && !validPaymentStatuses.includes(payload.status)) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid status, must be one of: ${validPaymentStatuses.join(", ")}`
    );
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.status !== undefined) updateValues.status = payload.status;
  if (payload.paymentMethod !== undefined) updateValues.paymentMethod = payload.paymentMethod;
  if (payload.failureReason !== undefined) updateValues.failureReason = payload.failureReason;

  const rows = await db
    .update(payments)
    .set(updateValues)
    .where(
      and(
        eq(payments.id, id),
        isSuperAdmin(auth.role) ? undefined : eq(payments.companyId, auth.companyId)
      )
    )
    .returning();

  const updated = rows[0];
  if (!updated) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  return updated;
};

export const refundPayment = async (
  id: string,
  payload: RefundPaymentPayload,
  auth: AuthContext
): Promise<Payment> => {
  requireAdmin(auth);
  assertUuidParam(id);

  const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);

  const payment = rows[0];
  if (!payment) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);

  if (!isSuperAdmin(auth.role) && payment.companyId !== auth.companyId) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  if (payment.status !== "captured") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Only captured payments can be refunded");
  }

  if (!payment.razorpayPaymentId) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Razorpay payment ID not found");
  }

  const razorpay = getRazorpay();
  try {
    await (razorpay.payments as any).refund(payment.razorpayPaymentId, {
      ...(payload.amount && { amount: payload.amount }),
      notes: { reason: payload.reason ?? "Refund requested" }
    });
  } catch (err: any) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      err?.error?.description ?? "Failed to process refund"
    );
  }

  const updated = await db
    .update(payments)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(eq(payments.id, payment.id))
    .returning();

  return updated[0];
};

export const handleWebhook = async (rawBody: Buffer, signature: string): Promise<void> => {
  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody.toString("utf8"))
    .digest("hex");

  if (expectedSignature !== signature) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Invalid webhook signature");
  }

  let event: { event: string; payload: any };
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Invalid webhook payload");
  }

  const razorpayPaymentId: string | undefined = event.payload?.payment?.entity?.id;
  const razorpayOrderId: string | undefined = event.payload?.payment?.entity?.order_id;
  const paymentMethod: string | undefined = event.payload?.payment?.entity?.method;
  const errorDescription: string | undefined = event.payload?.payment?.entity?.error_description;

  if (!razorpayOrderId) return;

  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayOrderId, razorpayOrderId))
    .limit(1);

  const payment = rows[0];
  if (!payment) return;

  switch (event.event) {
    case "payment.authorized":
      await db
        .update(payments)
        .set({
          status: "authorized",
          razorpayPaymentId: razorpayPaymentId ?? payment.razorpayPaymentId,
          paymentMethod: paymentMethod ?? payment.paymentMethod,
          updatedAt: new Date()
        })
        .where(eq(payments.id, payment.id));
      break;

    case "payment.captured":
      await db
        .update(payments)
        .set({
          status: "captured",
          razorpayPaymentId: razorpayPaymentId ?? payment.razorpayPaymentId,
          paymentMethod: paymentMethod ?? payment.paymentMethod,
          paidAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(payments.id, payment.id));
      break;

    case "payment.failed":
      await db
        .update(payments)
        .set({
          status: "failed",
          razorpayPaymentId: razorpayPaymentId ?? payment.razorpayPaymentId,
          failureReason: errorDescription ?? "Payment failed",
          updatedAt: new Date()
        })
        .where(eq(payments.id, payment.id));
      break;

    case "refund.created":
    case "refund.processed":
      await db
        .update(payments)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      break;

    default:
      break;
  }
};
