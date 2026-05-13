import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies, templates } from "db/schema";
import {
  assertTemplateButtons,
  assertTemplateStringArray,
  assertTemplateStringMatrix,
  mapTemplateSortByToColumn,
  parseTemplateCategory,
  parseTemplateHeaderType,
  parseTemplateStatusFilter,
  templateNotDeletedCondition
} from "helpers/template.helpers";
import { logger } from "logger/app.logger";
import {
  deleteTemplateFromMeta,
  fetchMetaTemplateStatuses,
  submitTemplateToMeta
} from "services/meta.service";
import { AuthContext } from "types/common.types";
import { CreateTemplatePayload, Template } from "types/templates.types";
import { ApiError } from "utils/api-error.utils";
import { getMissingFields, handleUniqueViolation, isAdmin, isStaff } from "utils/helpers";
import { assertUuidParam, buildListResponse, parseQ, parseSort } from "utils/list.utils";
import { parsePagination } from "utils/pagination.utils";
import { assertOwnS3Key, deleteS3Object, getS3SignedUrl } from "utils/s3.utils";

const withSignedUrl = async (template: Template): Promise<Template> => {
  if (!template.headerMediaUrl) return template;
  const signedUrl = await getS3SignedUrl(template.headerMediaUrl);
  return { ...template, headerMediaUrl: signedUrl };
};

export const createTemplate = async (
  payload: CreateTemplatePayload,
  auth: AuthContext
): Promise<Template> => {
  logger.info("creating template");
  const missingInputs = getMissingFields(payload, [
    "name",
    "category",
    "headerType",
    "language",
    "body"
  ]);

  if (missingInputs.length > 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `missing [${missingInputs.join(", ")}]`);
  }

  const category = parseTemplateCategory(payload.category);
  const headerType = parseTemplateHeaderType(payload.headerType);
  const headerExample = assertTemplateStringArray(payload.headerExample, "headerExample");
  const bodyExample = assertTemplateStringMatrix(payload.bodyExample, "bodyExample");
  const buttons = assertTemplateButtons(payload.buttons);

  if (payload.headerMediaUrl) {
    assertOwnS3Key(payload.headerMediaUrl, "headerMediaUrl");
  }

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

  let created: Template;

  try {
    const rows = await db.insert(templates).values(insertValues).returning();
    const row = rows[0];
    if (!row) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
      );
    }
    created = row;
  } catch (err) {
    logger.error("failed to insert the template to db");
    return handleUniqueViolation(err);
  }

  logger.info("inserted the template to db");

  const [company] = await db
    .select({ wabaId: companies.wabaId, accessToken: companies.whatsappAccessToken })
    .from(companies)
    .where(eq(companies.id, auth.companyId))
    .limit(1);

  if (!company?.wabaId || !company?.accessToken) {
    logger.error("Cannot submit template to Meta: company missing wabaId or accessToken", {
      companyId: auth.companyId,
      templateId: created.id
    });
    return created;
  }

  let metaResponse;
  try {
    metaResponse = await submitTemplateToMeta(company.wabaId, company.accessToken, created);
    logger.info("created template in the meta");
  } catch (err) {
    logger.error("Meta template submission failed, rolling back DB insert", {
      err,
      templateId: created.id
    });
    await db.delete(templates).where(eq(templates.id, created.id));
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      err instanceof Error ? err.message : "Failed to submit template to Meta"
    );
  }

  const [updated] = await db
    .update(templates)
    .set({ metaTemplateId: metaResponse.id })
    .where(eq(templates.id, created.id))
    .returning();

  logger.info("template creation success");

  return updated ?? created;
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

  return withSignedUrl(row);
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
  logger.info("getting template list");
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

  logger.info("fetched templates list from db");

  const total = Number(countRows[0]?.total ?? 0);

  const items = await Promise.all((itemsRows as Template[]).map(withSignedUrl));

  const response = buildListResponse({ items, page, limit, total });

  logger.info("built response for tempate");

  const pending = (itemsRows as Template[]).filter(
    (t) => t.status === "pending" && !!t.metaTemplateId
  );

  if (pending.length > 0) {
    void syncPendingTemplateStatuses(pending, auth.companyId).catch((err) =>
      logger.error("Background template status sync failed", { err, companyId: auth.companyId })
    );
  }

  logger.info("successfully fetched templates list");

  return response;
};

async function syncPendingTemplateStatuses(pending: Template[], companyId: string): Promise<void> {
  logger.info("syncing template status from meta");
  const [company] = await db
    .select({ accessToken: companies.whatsappAccessToken })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company?.accessToken) return;

  const metaStatuses = await fetchMetaTemplateStatuses(
    pending.map((t) => t.metaTemplateId!),
    company.accessToken
  );

  const statusMap = new Map(metaStatuses.map((s) => [s.id, s]));

  const updates = pending.flatMap((t) => {
    const meta = statusMap.get(t.metaTemplateId!);
    if (!meta) return [];

    const newStatus =
      meta.status === "APPROVED"
        ? ("approved" as const)
        : meta.status === "REJECTED"
          ? ("rejected" as const)
          : null;

    if (!newStatus) return [];

    return [
      {
        id: t.id,
        status: newStatus,
        rejectionMessage: meta.rejected_reason ?? null
      }
    ];
  });

  if (updates.length === 0) return;

  await Promise.all(
    updates.map(({ id, status, rejectionMessage }) =>
      db
        .update(templates)
        .set({ status, rejectionMessage, updatedAt: new Date() })
        .where(eq(templates.id, id))
    )
  );
}

export const deleteTemplate = async (id: string, auth: AuthContext): Promise<{ id: string }> => {
  logger.info("deleting template");
  assertUuidParam(id);

  const conditions = [
    eq(templates.id, id),
    templateNotDeletedCondition(),
    eq(templates.companyId, auth.companyId)
  ];

  const whereCond = and(...conditions);

  const existing = await db.select().from(templates).where(whereCond).limit(1);
  const template = existing[0];

  if (!template) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "template not found");
  }

  const [company] = await db
    .select({ wabaId: companies.wabaId, accessToken: companies.whatsappAccessToken })
    .from(companies)
    .where(eq(companies.id, auth.companyId))
    .limit(1);

  if (company?.wabaId && company?.accessToken) {
    try {
      await deleteTemplateFromMeta(company.wabaId, company.accessToken, template.name);
      logger.info("successfully deleted tempate from meta");
    } catch (err) {
      logger.error("Failed to delete template from Meta", { err, templateId: id });
    }
  }

  // Hard delete from DB
  await db.delete(templates).where(eq(templates.id, id));

  logger.info("deleted template from db");

  // Delete media from S3 if present
  if (template.headerMediaUrl) {
    deleteS3Object(template.headerMediaUrl).catch((err) => {
      logger.error("Failed to delete template media from S3", {
        err,
        key: template.headerMediaUrl
      });
    });

    logger.info("deleted tempalte media from s3");
  }

  return { id };
};
