import { and, asc, count, desc, eq } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { invoices, payments } from "db/schema";
import { AuthContext } from "types/common.types";
import {
  CreateInvoicePayload,
  Invoice,
  UpdateInvoicePayload,
  validInvoiceStatuses
} from "types/invoices.types";
import { ApiError } from "utils/api-error.utils";
import { handleUniqueViolation, isSuperAdmin, requireAdmin } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

const generateInvoiceNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}${month}${day}-${suffix}`;
};

const mapSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    invoiceNumber: invoices.invoiceNumber,
    totalAmount: invoices.totalAmount,
    status: invoices.status,
    issuedAt: invoices.issuedAt,
    dueAt: invoices.dueAt,
    paidAt: invoices.paidAt,
    createdAt: invoices.createdAt,
    updatedAt: invoices.updatedAt
  };
  return sortMap[sortBy] ?? invoices.createdAt;
};

export const createInvoice = async (
  payload: CreateInvoicePayload,
  auth: AuthContext
): Promise<Invoice> => {
  requireAdmin(auth);

  if (!payload.totalAmount || payload.totalAmount <= 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "totalAmount must be a positive integer");
  }

  if (payload.paymentId) {
    assertUuidParam(payload.paymentId);

    const paymentRows = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.id, payload.paymentId), eq(payments.companyId, auth.companyId)))
      .limit(1);

    if (!paymentRows[0]) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Payment not found");
    }
  }

  if (payload.subscriptionId) {
    assertUuidParam(payload.subscriptionId);
  }

  let invoice: Invoice;
  try {
    const rows = await db
      .insert(invoices)
      .values({
        companyId: auth.companyId,
        subscriptionId: payload.subscriptionId ?? null,
        paymentId: payload.paymentId ?? null,
        invoiceNumber: generateInvoiceNumber(),
        taxAmount: payload.taxAmount ?? 0,
        totalAmount: payload.totalAmount,
        currency: payload.currency ?? "INR",
        status: payload.status ?? "draft",
        notes: payload.notes ?? null,
        pdfUrl: payload.pdfUrl ?? null,
        issuedAt: new Date(),
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null
      })
      .returning();

    invoice = rows[0]!;
  } catch (err) {
    handleUniqueViolation(err);
  }

  return invoice!;
};

export const getInvoiceById = async (id: string, auth: AuthContext): Promise<Invoice> => {
  assertUuidParam(id);

  const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

  const invoice = rows[0];
  if (!invoice) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);

  if (!isSuperAdmin(auth.role) && invoice.companyId !== auth.companyId) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return invoice;
};

export const listInvoices = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: Invoice[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: [
      "invoiceNumber",
      "totalAmount",
      "status",
      "issuedAt",
      "dueAt",
      "paidAt",
      "createdAt",
      "updatedAt"
    ],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapSortByToColumn(sortBy) as any;
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const baseConditions: any[] = [];

  if (!isSuperAdmin(auth.role)) {
    baseConditions.push(eq(invoices.companyId, auth.companyId));
  } else {
    const companyIdFilter = typeof query.companyId === "string" ? query.companyId.trim() : "";
    if (companyIdFilter.length > 0) {
      assertUuidParam(companyIdFilter);
      baseConditions.push(eq(invoices.companyId, companyIdFilter));
    }
  }

  const statusFilter = typeof query.status === "string" ? query.status.trim() : "";
  if (statusFilter.length > 0) {
    if (!validInvoiceStatuses.includes(statusFilter as any)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid status, must be one of: ${validInvoiceStatuses.join(", ")}`
      );
    }
    baseConditions.push(eq(invoices.status, statusFilter as (typeof validInvoiceStatuses)[number]));
  }

  const paymentIdFilter = typeof query.paymentId === "string" ? query.paymentId.trim() : "";
  if (paymentIdFilter.length > 0) {
    assertUuidParam(paymentIdFilter);
    baseConditions.push(eq(invoices.paymentId, paymentIdFilter));
  }

  const subscriptionIdFilter =
    typeof query.subscriptionId === "string" ? query.subscriptionId.trim() : "";
  if (subscriptionIdFilter.length > 0) {
    assertUuidParam(subscriptionIdFilter);
    baseConditions.push(eq(invoices.subscriptionId, subscriptionIdFilter));
  }

  const whereCond = baseConditions.length > 0 ? and(...baseConditions) : undefined;

  const [countRows, items] = await Promise.all([
    db
      .select({ total: count(invoices.id) })
      .from(invoices)
      .where(whereCond),
    db.select().from(invoices).where(whereCond).limit(limit).offset(offset).orderBy(orderBy)
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return buildListResponse({ items: items as Invoice[], page, limit, total });
};

export const updateInvoice = async (
  id: string,
  payload: UpdateInvoicePayload,
  auth: AuthContext
): Promise<Invoice> => {
  requireAdmin(auth);
  assertUuidParam(id);

  if (payload.status !== undefined && !validInvoiceStatuses.includes(payload.status)) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid status, must be one of: ${validInvoiceStatuses.join(", ")}`
    );
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.status !== undefined) updateValues.status = payload.status;
  if (payload.notes !== undefined) updateValues.notes = payload.notes;
  if (payload.pdfUrl !== undefined) updateValues.pdfUrl = payload.pdfUrl;
  if (payload.dueAt !== undefined) updateValues.dueAt = new Date(payload.dueAt);
  if (payload.paidAt !== undefined) updateValues.paidAt = new Date(payload.paidAt);

  const rows = await db
    .update(invoices)
    .set(updateValues)
    .where(
      and(
        eq(invoices.id, id),
        isSuperAdmin(auth.role) ? undefined : eq(invoices.companyId, auth.companyId)
      )
    )
    .returning();

  const updated = rows[0];
  if (!updated) throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  return updated;
};
