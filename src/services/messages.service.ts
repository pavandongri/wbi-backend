import { and, asc, count, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies, messages } from "db/schema";
import {
  assertTemplateUsableForAuth,
  costToCredits,
  loadActiveTemplateForCompany,
  mapMessageSortByToColumn,
  parseMessageDirectionFilter,
  parseMessageStatus,
  parseMessageStatusFilter,
  parseMessageType,
  parseMessageTypeFilter,
  parseOptionalIsoDate,
  resolveMessageCost,
  resolveTemplateMessageParams
} from "helpers/message.helpers";
import { sendTemplateMessage, sendTextMessage } from "services/meta.service";
import { AuthContext } from "types/common.types";
import {
  CreateMessagePayload,
  Message,
  MessageType,
  UpdateMessagePayload
} from "types/messages.types";
import { ApiError } from "utils/api-error.utils";
import { getMissingFields, isStaff } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";
import { parseE164Phone } from "utils/phone.utils";

export const createMessage = async (
  payload: CreateMessagePayload,
  auth: AuthContext
): Promise<Message> => {
  const missingInputs = getMissingFields(payload, ["from", "to"]);

  if (missingInputs.length > 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `missing [${missingInputs.join(", ")}]`);
  }

  const companyId = auth.companyId;

  const from = parseE164Phone(payload.from, "from");
  const to = parseE164Phone(payload.to, "to");

  const templateId = payload.templateId?.toString().trim() || null;
  const body = payload.body?.toString().trim() || "";

  if (templateId) {
    assertUuidParam(templateId);
  }

  if (!templateId && !body) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "body is required when templateId is not provided");
  }

  /**
   * Load company + validate configuration
   */
  const [company] = await db
    .select({
      id: companies.id,
      status: companies.status,
      messageCredits: companies.messageCredits,
      whatsappPhoneNumberId: companies.whatsappPhoneNumberId,
      whatsappAccessToken: companies.whatsappAccessToken
    })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.status, "active")))
    .limit(1);

  if (!company) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "company not found");
  }

  if (!company.whatsappPhoneNumberId || !company.whatsappAccessToken) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      "Company WhatsApp is not configured. Complete onboarding first."
    );
  }

  /**
   * Resolve template data
   */
  let templateName: string | null = null;
  let templateLanguage: string | null = null;
  let templateCategory: string | null = null;
  let templateHeaderParams: string | null = null;
  let templateBodyParams: string[] | null = null;

  if (templateId) {
    const template = await loadActiveTemplateForCompany(templateId, companyId);

    if (!template) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "template not found for this company");
    }

    assertTemplateUsableForAuth(template, auth);

    const resolvedParams = resolveTemplateMessageParams(template, {
      templateHeaderParams: payload.templateHeaderParams,
      templateBodyParams: payload.templateBodyParams
    });

    templateHeaderParams = resolvedParams.templateHeaderParams;
    templateBodyParams = resolvedParams.templateBodyParams;

    templateName = template.name;
    templateLanguage = template.language;
    templateCategory = template.category;
  }

  /**
   * Resolve message type
   */
  const messageType: MessageType = payload.messageType
    ? parseMessageType(payload.messageType)
    : (templateCategory as MessageType) || "text";

  const costInr = resolveMessageCost(messageType);
  const costInCredits = costToCredits(costInr);

  const baseMessagePayload = {
    companyId,
    from,
    to,
    body: body || null,
    templateId,
    templateHeaderParams,
    templateBodyParams,
    messageType,
    direction: "outbound" as const,
    failedReason: payload.failedReason?.toString() || null,
    userId: auth.userId,
    cost: costInr
  };

  /**
   * Insufficient credits
   */
  if ((company.messageCredits ?? 0) < costInCredits) {
    const [created] = await db
      .insert(messages)
      .values({
        ...baseMessagePayload,
        status: "failed",
        failedReason: "insufficient_message_credits"
      })
      .returning();

    if (!created) {
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create message");
    }

    return created;
  }

  /**
   * Create message before sending
   */
  const [message] = await db
    .insert(messages)
    .values({
      ...baseMessagePayload,
      status: "created"
    })
    .returning();

  if (!message) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
    );
  }

  try {
    let wamid: string;

    if (templateId && templateName && templateLanguage) {
      const response = await sendTemplateMessage(
        company.whatsappPhoneNumberId,
        company.whatsappAccessToken,
        to,
        templateName,
        templateLanguage,
        templateHeaderParams,
        templateBodyParams
      );

      wamid = response.messageId;
    } else {
      const response = await sendTextMessage(
        company.whatsappPhoneNumberId,
        company.whatsappAccessToken,
        to,
        body
      );

      wamid = response.messageId;
    }

    /**
     * Deduct credits safely
     */
    const creditUpdateResult = await db
      .update(companies)
      .set({
        messageCredits: sql`${companies.messageCredits} - ${costInCredits}`
      })
      .where(and(eq(companies.id, companyId), gte(companies.messageCredits, costInCredits)))
      .returning({ id: companies.id });

    if (creditUpdateResult.length === 0) {
      await db
        .update(messages)
        .set({
          status: "failed",
          failedReason: "insufficient_message_credits"
        })
        .where(eq(messages.id, message.id));

      return {
        ...message,
        status: "failed",
        failedReason: "insufficient_message_credits"
      };
    }

    const [updatedMessage] = await db
      .update(messages)
      .set({
        sentAt: new Date(),
        wamid
      })
      .where(eq(messages.id, message.id))
      .returning();

    return updatedMessage ?? message;
  } catch (error) {
    const [failedMessage] = await db
      .update(messages)
      .set({
        status: "failed",
        failedReason: (error as Error)?.message || "WhatsApp API call failed"
      })
      .where(eq(messages.id, message.id))
      .returning();

    return failedMessage ?? message;
  }
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
    allowSortBy: [
      "createdAt",
      "status",
      "direction",
      "messageType",
      "from",
      "to",
      "cost",
      "sentAt"
    ],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapMessageSortByToColumn(sortBy) as Parameters<typeof asc>[0];
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const conditions: SQL[] = [];

  conditions.push(eq(messages.companyId, auth.companyId));

  const statusFilter = parseMessageStatusFilter(query.status);
  if (statusFilter) {
    conditions.push(eq(messages.status, statusFilter));
  }

  const directionFilter = parseMessageDirectionFilter(query.direction);
  if (directionFilter) {
    conditions.push(eq(messages.direction, directionFilter));
  }

  const messageTypeFilter = parseMessageTypeFilter(query.messageType);
  if (messageTypeFilter) {
    conditions.push(eq(messages.messageType, messageTypeFilter));
  }

  if (q) {
    conditions.push(
      or(
        ilike(messages.from, `%${q}%`),
        ilike(messages.to, `%${q}%`),
        ilike(messages.body, `%${q}%`)
      )!
    );
  }

  if (isStaff(auth.role)) {
    conditions.push(eq(messages.userId, auth.userId));
  }

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
  if (payload.messageType !== undefined && payload.messageType !== null) {
    updateValues.messageType = parseMessageType(payload.messageType);
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
  if (payload.failedReason !== undefined) {
    updateValues.failedReason = payload.failedReason === null ? null : String(payload.failedReason);
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
