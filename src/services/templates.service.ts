import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { templates } from "db/schema";
import {
  assertTemplateButtons,
  assertTemplateStringArray,
  assertTemplateStringMatrix,
  mapTemplateSortByToColumn,
  parsePatchableTemplateStatus,
  parseTemplateCategory,
  parseTemplateHeaderType,
  parseTemplateStatusFilter,
  templateNotDeletedCondition
} from "helpers/template.helpers";
import { AuthContext } from "types/common.types";
import { CreateTemplatePayload, Template, UpdateTemplatePayload } from "types/templates.types";
import { ApiError } from "utils/api-error.utils";
import { getMissingFields, handleUniqueViolation, isAdmin, isStaff } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";

export const createTemplate = async (
  payload: CreateTemplatePayload,
  auth: AuthContext
): Promise<Template> => {
  const missingInputs = getMissingFields(payload, [
    "name",
    "language",
    "body",
    "category",
    "headerType"
  ]);

  if (missingInputs.length > 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `missing [${missingInputs.join(", ")}]`);
  }

  const category = parseTemplateCategory(payload.category);
  const headerType = parseTemplateHeaderType(payload.headerType);
  const headerExample = assertTemplateStringArray(payload.headerExample, "headerExample");
  const bodyExample = assertTemplateStringMatrix(payload.bodyExample, "bodyExample");
  const buttons = assertTemplateButtons(payload.buttons);

  const insertValues = {
    companyId: auth.companyId,
    userId: auth.userId,
    name: payload.name.trim(),
    language: payload.language.trim(),
    category,
    headerType,
    headerText:
      payload.headerText === undefined || payload.headerText === null
        ? null
        : String(payload.headerText),
    headerMediaUrl:
      payload.headerMediaUrl === undefined || payload.headerMediaUrl === null
        ? null
        : String(payload.headerMediaUrl),
    headerMediaHandler:
      payload.headerMediaHandler === undefined || payload.headerMediaHandler === null
        ? null
        : String(payload.headerMediaHandler),
    headerExample: headerExample ?? null,
    body: payload.body.trim(),
    bodyExample: bodyExample ?? null,
    footer: payload.footer === undefined || payload.footer === null ? null : String(payload.footer),
    buttons: buttons ?? null,
    status: "pending" as const,
    rejectionMessage:
      payload.rejectionMessage === undefined || payload.rejectionMessage === null
        ? null
        : String(payload.rejectionMessage)
  };

  try {
    const rows = await db.insert(templates).values(insertValues).returning();
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

export const getTemplateById = async (id: string, auth: AuthContext): Promise<Template> => {
  assertUuidParam(id);

  const whereCond = and(
    eq(templates.id, id),
    templateNotDeletedCondition(),
    eq(templates.companyId, auth.companyId)
  );

  const rows = await db.select().from(templates).where(whereCond).limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  if (isStaff(auth.role) && row.userId !== auth.userId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, HTTP_MESSAGES.ERROR.FORBIDDEN);
  }

  if (isAdmin(auth.role) && row.companyId !== auth.companyId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, HTTP_MESSAGES.ERROR.FORBIDDEN);
  }

  return row;
};

export const listTemplates = async (
  query: Record<string, unknown>,
  auth: AuthContext
): Promise<{
  items: Template[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePagination(query);
  const q = parseQ(query);
  const { sortBy, sortOrder } = parseSort(query, {
    allowSortBy: ["name", "language", "category", "status", "createdAt", "updatedAt"],
    defaultSortBy: "createdAt"
  });

  const sortColumn = mapTemplateSortByToColumn(sortBy) as Parameters<typeof asc>[0];
  const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const baseConditions: SQL[] = [templateNotDeletedCondition()];

  if (isAdmin(auth.role)) {
    baseConditions.push(eq(templates.companyId, auth.companyId));
  }

  if (isStaff(auth.role)) {
    baseConditions.push(eq(templates.userId, auth.userId));
  }

  const statusFilter = parseTemplateStatusFilter(query.status);

  if (statusFilter) {
    baseConditions.push(eq(templates.status, statusFilter));
  }

  if (q) {
    baseConditions.push(
      or(
        ilike(templates.name, `%${q}%`),
        ilike(templates.language, `%${q}%`),
        ilike(templates.body, `%${q}%`)
      )!
    );
  }

  const whereCond = and(...baseConditions);

  const [countRows, itemsRows] = await Promise.all([
    db
      .select({ total: count(templates.id) })
      .from(templates)
      .where(whereCond),
    db.select().from(templates).where(whereCond).limit(limit).offset(offset).orderBy(orderBy)
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return buildListResponse({ items: itemsRows as Template[], page, limit, total });
};

export const updateTemplate = async (
  id: string,
  payload: UpdateTemplatePayload,
  auth: AuthContext
): Promise<Template> => {
  assertUuidParam(id);

  const conditions: SQL[] = [
    eq(templates.id, id),
    templateNotDeletedCondition(),
    eq(templates.companyId, auth.companyId)
  ];

  const whereCond = and(...conditions);

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date()
  };

  if (payload.name !== undefined) updateValues.name = String(payload.name).trim();
  if (payload.language !== undefined) updateValues.language = String(payload.language).trim();
  if (payload.category !== undefined)
    updateValues.category = parseTemplateCategory(payload.category);
  if (payload.headerType !== undefined) {
    updateValues.headerType = parseTemplateHeaderType(payload.headerType);
  }
  if (payload.headerText !== undefined) {
    updateValues.headerText = payload.headerText === null ? null : String(payload.headerText);
  }
  if (payload.headerMediaUrl !== undefined) {
    updateValues.headerMediaUrl =
      payload.headerMediaUrl === null ? null : String(payload.headerMediaUrl);
  }
  if (payload.headerMediaHandler !== undefined) {
    updateValues.headerMediaHandler =
      payload.headerMediaHandler === null ? null : String(payload.headerMediaHandler);
  }
  if (payload.headerExample !== undefined) {
    updateValues.headerExample =
      payload.headerExample === null
        ? null
        : assertTemplateStringArray(payload.headerExample, "headerExample");
  }
  if (payload.body !== undefined) updateValues.body = String(payload.body).trim();
  if (payload.bodyExample !== undefined) {
    updateValues.bodyExample =
      payload.bodyExample === null
        ? null
        : assertTemplateStringMatrix(payload.bodyExample, "bodyExample");
  }
  if (payload.footer !== undefined) {
    updateValues.footer = payload.footer === null ? null : String(payload.footer);
  }
  if (payload.buttons !== undefined) {
    updateValues.buttons = payload.buttons === null ? null : assertTemplateButtons(payload.buttons);
  }
  if (payload.rejectionMessage !== undefined) {
    updateValues.rejectionMessage =
      payload.rejectionMessage === null ? null : String(payload.rejectionMessage);
  }
  if (payload.status !== undefined) {
    updateValues.status = parsePatchableTemplateStatus(payload.status);
  }

  try {
    const rows = await db.update(templates).set(updateValues).where(whereCond).returning();
    const updated = rows[0];
    if (!updated) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
    }
    return updated as Template;
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const deleteTemplate = async (id: string, auth: AuthContext): Promise<{ id: string }> => {
  assertUuidParam(id);

  const conditions = [eq(templates.id, id), templateNotDeletedCondition()];

  if (isAdmin(auth.role)) {
    conditions.push(eq(templates.companyId, auth.companyId));
  }

  if (isStaff(auth.role)) {
    conditions.push(eq(templates.userId, auth.userId));
  }

  const whereCond = and(...conditions);

  const rows = await db
    .update(templates)
    .set({
      status: "deleted",
      deletedBy: auth.userId,
      deletedAt: new Date(),
      updatedAt: new Date()
    })
    .where(whereCond)
    .returning({ id: templates.id });

  const deleted = rows[0];

  // TODO: delete this template from meta also

  if (!deleted) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  return { id: deleted.id };
};
