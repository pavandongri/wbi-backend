import { and, eq, ne } from "drizzle-orm";

import { env } from "config/env";
import { ROLES } from "constants/common.constants";
import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import {
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
  MESSAGE_TYPES,
  MessageDirection,
  MessageStatus,
  MessageType
} from "constants/message.constants";
import { db } from "db/index";
import { messages, templates } from "db/schema";
import { AuthContext } from "types/common.types";
import { ApiError } from "utils/api-error.utils";

export type TemplateRow = typeof templates.$inferSelect;

export const parseMessageStatus = (raw: unknown): MessageStatus => {
  if (typeof raw !== "string") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.VALIDATION_FAILED);
  }
  const s = raw.trim().toLowerCase();
  if (!MESSAGE_STATUSES.includes(s as MessageStatus)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "status is invalid");
  }
  return s as MessageStatus;
};

export const parseMessageStatusFilter = (raw: unknown): MessageStatus | undefined => {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  return parseMessageStatus(raw);
};

export const parseMessageDirection = (raw: unknown): MessageDirection => {
  if (typeof raw !== "string") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.VALIDATION_FAILED);
  }
  const d = raw.trim().toLowerCase();
  if (!MESSAGE_DIRECTIONS.includes(d as MessageDirection)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "direction must be inbound or outbound");
  }
  return d as MessageDirection;
};

export const parseMessageDirectionFilter = (raw: unknown): MessageDirection | undefined => {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  return parseMessageDirection(raw);
};

export const assertMessageTemplateBodyParams = (value: unknown, field: string): string[] | null => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field} must be an array of strings`);
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== "string") {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field} must be an array of strings`);
    }
  }
  return value as string[];
};

export const parseOptionalIsoDate = (value: unknown, field: string): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field} is not a valid date`);
    }
    return value;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field} is not a valid date`);
    }
    return d;
  }
  throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field} is not a valid date`);
};

export const parseMessageCost = (value: unknown, field: string): number | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field} must be a non-negative number`);
  }
  return n;
};

export const parseMessageType = (raw: unknown): MessageType => {
  if (typeof raw !== "string") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "messageType is invalid");
  }
  const t = raw.trim().toLowerCase() as MessageType;
  if (!MESSAGE_TYPES.includes(t)) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `messageType must be one of: ${MESSAGE_TYPES.join(", ")}`
    );
  }
  return t;
};

export const parseMessageTypeFilter = (raw: unknown) => {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  return parseMessageType(raw);
};

/** Returns cost in INR. text = 0 (session/free message). */
export const resolveMessageCost = (messageType: MessageType): number => {
  switch (messageType) {
    case "marketing":
      return parseFloat(env.MARKETING_MESSAGE_COST) || 0.97;
    case "utility":
      return parseFloat(env.UTILITY_MESSAGE_COST) || 0.22;
    case "authentication":
      return parseFloat(env.AUTHENTICATION_MESSAGE_COST) || 0.22;
    case "text":
      return 0;
  }
};

/**
 * Converts an INR cost to integer credits (paise: 1 credit = 0.01 INR).
 * Used to compare against company.messageCredits (stored as integer paise).
 */
export const costToCredits = (costInr: number): number => Math.round(costInr);

export const mapMessageSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    createdAt: messages.createdAt,
    status: messages.status,
    direction: messages.direction,
    messageType: messages.messageType,
    from: messages.from,
    to: messages.to,
    cost: messages.cost,
    sentAt: messages.sentAt
  };
  return sortMap[sortBy] ?? messages.createdAt;
};

/** Staff may only use templates they created; admin (and super_admin) may use any template in their company. */
export const assertTemplateUsableForAuth = (template: TemplateRow, auth: AuthContext): void => {
  if (template.companyId !== auth.companyId) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "template not found for this company");
  }
  if (auth.role === ROLES.STAFF && template.userId !== auth.userId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, HTTP_MESSAGES.ERROR.FORBIDDEN);
  }
};

export const loadActiveTemplateForCompany = async (
  templateId: string,
  companyId: string
): Promise<TemplateRow | null> => {
  const rows = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.id, templateId),
        eq(templates.companyId, companyId),
        ne(templates.status, "deleted")
      )
    )
    .limit(1);
  return rows[0] ?? null;
};

const templateNeedsHeaderParams = (template: TemplateRow): boolean =>
  template.headerType !== "none" &&
  Array.isArray(template.headerExample) &&
  template.headerExample.length > 0;

const templateNeedsBodyParams = (template: TemplateRow): boolean =>
  Array.isArray(template.bodyExample) && template.bodyExample.length > 0;

export const resolveTemplateMessageParams = (
  template: TemplateRow,
  payload: {
    templateHeaderParams?: string | null;
    templateBodyParams?: string[] | null;
  }
): { templateHeaderParams: string | null; templateBodyParams: string[] | null } => {
  const needsHeader = templateNeedsHeaderParams(template);
  const needsBody = templateNeedsBodyParams(template);

  if (needsHeader) {
    const v = payload.templateHeaderParams;
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        "templateHeaderParams is required for this template"
      );
    }
  }

  if (needsBody) {
    const arr = payload.templateBodyParams;
    if (arr === undefined || arr === null || !Array.isArray(arr) || arr.length === 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        "templateBodyParams is required for this template"
      );
    }
    assertMessageTemplateBodyParams(arr, "templateBodyParams");
  }

  const templateHeaderParams =
    payload.templateHeaderParams === undefined || payload.templateHeaderParams === null
      ? null
      : String(payload.templateHeaderParams);

  const templateBodyParams =
    payload.templateBodyParams === undefined
      ? null
      : assertMessageTemplateBodyParams(payload.templateBodyParams, "templateBodyParams");

  return { templateHeaderParams, templateBodyParams };
};

/** Meta API expects numbers without the leading '+' */
export const stripPlus = (phone: string) => phone.replace(/^\+/, "");
