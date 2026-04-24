import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { messages } from "db/schema";
import {
  assertTemplateUsableForAuth,
  loadActiveTemplateForCompany,
  mapMessageSortByToColumn,
  parseMessageCost,
  parseMessageDirection,
  parseMessageDirectionFilter,
  parseMessageStatus,
  parseMessageStatusFilter,
  parseOptionalIsoDate,
  resolveTemplateMessageParams
} from "helpers/message.helpers";
import { AuthContext } from "types/common.types";
import { CreateMessagePayload, Message, UpdateMessagePayload } from "types/messages.types";
import { ApiError } from "utils/api-error.utils";
import { getMissingFields, isStaff } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";
import { parseE164Phone } from "utils/phone.utils";

export const createMessage = async (
  payload: CreateMessagePayload,
  auth: AuthContext
): Promise<Message> => {
  const missingInputs = getMissingFields(payload, ["from", "to", "direction"]);

  if (missingInputs.length > 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `missing [${missingInputs.join(", ")}]`);
  }

  const companyId = auth.companyId;
  const from = parseE164Phone(payload.from, "from");
  const to = parseE164Phone(payload.to, "to");
  const direction = parseMessageDirection(payload.direction);

  const templateIdRaw = payload.templateId;
  const templateId =
    templateIdRaw === undefined || templateIdRaw === null || String(templateIdRaw).trim() === ""
      ? null
      : String(templateIdRaw).trim();

  if (templateId) {
    assertUuidParam(templateId);
  }

  const bodyRaw = payload.body;
  const bodyStr = bodyRaw === undefined || bodyRaw === null ? "" : String(bodyRaw).trim();

  let templateHeaderParams: string | null = null;
  let templateBodyParams: string[] | null = null;

  if (templateId) {
    const templateRow = await loadActiveTemplateForCompany(templateId, companyId);
    if (!templateRow) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "template not found for this company");
    }
    assertTemplateUsableForAuth(templateRow, auth);
    const resolved = resolveTemplateMessageParams(templateRow, {
      templateHeaderParams: payload.templateHeaderParams,
      templateBodyParams: payload.templateBodyParams
    });
    templateHeaderParams = resolved.templateHeaderParams;
    templateBodyParams = resolved.templateBodyParams;
  } else if (bodyStr.length === 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "body is required when templateId is not provided");
  }

  // TODO: enqueue this message and transition status to "queued" when the worker picks it up.
  const status = "created" as const;

  const sentAt = parseOptionalIsoDate(payload.sentAt, "sentAt");
  const deliveredAt = parseOptionalIsoDate(payload.deliveredAt, "deliveredAt");
  const readAt = parseOptionalIsoDate(payload.readAt, "readAt");

  const cost = parseMessageCost(payload.cost, "cost") ?? 0;

  const failedReason =
    payload.failedReason === undefined || payload.failedReason === null
      ? null
      : String(payload.failedReason);

  const insertValues = {
    companyId,
    from,
    to,
    body: bodyStr.length > 0 ? bodyStr : null,
    templateId,
    templateHeaderParams,
    templateBodyParams,
    status,
    direction,
    failedReason,
    userId: auth.userId,
    cost,
    sentAt: sentAt === undefined ? null : sentAt,
    deliveredAt: deliveredAt === undefined ? null : deliveredAt,
    readAt: readAt === undefined ? null : readAt
  };

  const rows = await db.insert(messages).values(insertValues).returning();
  const created = rows[0];
  if (!created) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
    );
  }
  return created;
};

export const getMessageById = async (id: string, auth: AuthContext): Promise<Message> => {
  assertUuidParam(id);

  const whereCond = and(eq(messages.id, id), eq(messages.companyId, auth.companyId));

  const rows = await db.select().from(messages).where(whereCond).limit(1);

  const row = rows[0];
  if (!row) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }
  return row;
};

export const listMessages = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: Message[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);

  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["createdAt", "status", "direction", "from", "to", "cost", "sentAt"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapMessageSortByToColumn(sortBy) as Parameters<typeof asc>[0];
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  // ✅ Build conditions safely
  const conditions: SQL[] = [];

  // Always scope by company
  conditions.push(eq(messages.companyId, auth.companyId));

  // Optional filters
  const statusFilter = parseMessageStatusFilter(query.status);
  if (statusFilter) {
    conditions.push(eq(messages.status, statusFilter));
  }

  const directionFilter = parseMessageDirectionFilter(query.direction);
  if (directionFilter) {
    conditions.push(eq(messages.direction, directionFilter));
  }

  // Search
  if (q) {
    conditions.push(
      or(
        ilike(messages.from, `%${q}%`),
        ilike(messages.to, `%${q}%`),
        ilike(messages.body, `%${q}%`)
      )!
    );
  }

  // Role-based restriction
  if (isStaff(auth.role)) {
    conditions.push(eq(messages.userId, auth.userId));
  }

  // ✅ Handle empty conditions safely (important!)
  const whereCond = conditions.length ? and(...conditions) : undefined;

  try {
    const [countRows, itemsRows] = await Promise.all([
      db
        .select({ total: count(messages.id) })
        .from(messages)
        .where(whereCond),

      db.select().from(messages).where(whereCond).orderBy(orderBy).limit(limit).offset(offset)
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    return buildListResponse({
      items: itemsRows,
      page,
      limit,
      total
    });
  } catch (err) {
    console.error("❌ listMessages query failed", {
      err,
      role: auth.role,
      companyId: auth.companyId,
      userId: auth.userId,
      query,
      conditionsLength: conditions.length
    });

    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch messages");
  }
};

export const updateMessage = async (
  id: string,
  payload: UpdateMessagePayload,
  auth: AuthContext
): Promise<Message> => {
  assertUuidParam(id);

  const existing = await getMessageById(id, auth);

  const whereCond = and(eq(messages.id, id), eq(messages.companyId, auth.companyId));

  const updateValues: Record<string, unknown> = {};

  if (payload.from !== undefined) {
    updateValues.from = parseE164Phone(payload.from, "from");
  }
  if (payload.to !== undefined) {
    updateValues.to = parseE164Phone(payload.to, "to");
  }
  if (payload.body !== undefined) {
    updateValues.body = payload.body === null ? null : String(payload.body).trim() || null;
  }

  let nextTemplateId: string | null = existing.templateId;
  if (payload.templateId !== undefined) {
    const tidRaw = payload.templateId;
    const tid = tidRaw === null || String(tidRaw).trim() === "" ? null : String(tidRaw).trim();
    if (tid) {
      assertUuidParam(tid);
    }
    nextTemplateId = tid;
    updateValues.templateId = tid;
    if (tid === null) {
      updateValues.templateHeaderParams = null;
      updateValues.templateBodyParams = null;
    }
  }

  const touchesTemplateParams =
    payload.templateHeaderParams !== undefined || payload.templateBodyParams !== undefined;

  if (touchesTemplateParams && !nextTemplateId) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      "templateHeaderParams and templateBodyParams require an existing or new templateId"
    );
  }

  if (nextTemplateId && (payload.templateId !== undefined || touchesTemplateParams)) {
    const templateRow = await loadActiveTemplateForCompany(nextTemplateId, auth.companyId);
    if (!templateRow) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "template not found for this company");
    }
    assertTemplateUsableForAuth(templateRow, auth);
    const merged = {
      templateHeaderParams:
        payload.templateHeaderParams !== undefined
          ? payload.templateHeaderParams
          : existing.templateHeaderParams,
      templateBodyParams:
        payload.templateBodyParams !== undefined
          ? payload.templateBodyParams
          : existing.templateBodyParams
    };
    const resolved = resolveTemplateMessageParams(templateRow, merged);
    updateValues.templateHeaderParams = resolved.templateHeaderParams;
    updateValues.templateBodyParams = resolved.templateBodyParams;
  }

  if (payload.status !== undefined) {
    updateValues.status = parseMessageStatus(payload.status);
  }
  if (payload.direction !== undefined) {
    updateValues.direction = parseMessageDirection(payload.direction);
  }
  if (payload.failedReason !== undefined) {
    updateValues.failedReason = payload.failedReason === null ? null : String(payload.failedReason);
  }
  if (payload.cost !== undefined) {
    const c = parseMessageCost(payload.cost, "cost");
    if (c !== undefined) updateValues.cost = c;
  }
  if (payload.sentAt !== undefined) {
    updateValues.sentAt = parseOptionalIsoDate(payload.sentAt, "sentAt") ?? null;
  }
  if (payload.deliveredAt !== undefined) {
    updateValues.deliveredAt = parseOptionalIsoDate(payload.deliveredAt, "deliveredAt") ?? null;
  }
  if (payload.readAt !== undefined) {
    updateValues.readAt = parseOptionalIsoDate(payload.readAt, "readAt") ?? null;
  }

  if (Object.keys(updateValues).length === 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  const rows = await db.update(messages).set(updateValues).where(whereCond).returning();
  const updated = rows[0];
  if (!updated) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }
  return updated as Message;
};

export const deleteMessage = async (id: string, auth: AuthContext): Promise<{ id: string }> => {
  assertUuidParam(id);

  const conditions = [eq(messages.id, id), eq(messages.companyId, auth.companyId)];

  if (isStaff(auth.role)) {
    conditions.push(eq(messages.userId, auth.userId));
  }

  const whereCond = and(...conditions);

  const rows = await db.delete(messages).where(whereCond).returning({ id: messages.id });

  const removed = rows[0];

  if (!removed) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return { id: removed.id };
};
