import { ne } from "drizzle-orm";

import { HTTP_STATUS } from "constants/http-status.contants";
import {
  PATCHABLE_STATUSES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_HEADER_TYPES,
  TEMPLATE_STATUSES
} from "constants/template.constants";
import { templates } from "db/schema";
import {
  TemplateButton,
  TemplateCategory,
  TemplateHeaderType,
  TemplateStatus
} from "types/templates.types";
import { ApiError } from "utils/api-error.utils";
import { parseE164Phone } from "utils/phone.utils";

export const parseTemplateCategory = (raw: unknown): TemplateCategory => {
  if (typeof raw !== "string") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "template category is required");
  }
  const c = raw.trim().toUpperCase();
  if (TEMPLATE_CATEGORIES.includes(c as TemplateCategory)) {
    return c as TemplateCategory;
  }
  throw new ApiError(HTTP_STATUS.BAD_REQUEST, "invalid category must be MARKETING or UTILITY");
};

export const parseTemplateHeaderType = (raw: unknown): TemplateHeaderType => {
  if (typeof raw !== "string") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "header type is required");
  }
  const h = raw.trim().toUpperCase();
  if (TEMPLATE_HEADER_TYPES.includes(h as TemplateHeaderType)) {
    return h as TemplateHeaderType;
  }
  throw new ApiError(HTTP_STATUS.BAD_REQUEST, "headerType is invalid");
};

export const parseTemplateStatusFilter = (raw: unknown): TemplateStatus | undefined => {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  const s = raw.trim().toLowerCase();
  if (!TEMPLATE_STATUSES.includes(s as TemplateStatus)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "status query is invalid");
  }
  return s as TemplateStatus;
};

export const parsePatchableTemplateStatus = (raw: unknown): TemplateStatus => {
  if (typeof raw !== "string") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "invalid template status");
  }
  const s = raw.trim().toLowerCase();
  if (!PATCHABLE_STATUSES.includes(s as TemplateStatus)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "status cannot be set to that value via update");
  }
  return s as TemplateStatus;
};

export const assertTemplateStringArray = (value: unknown, field: string): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field}: must be an array of strings`);
  }
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== "string") {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field}: must be an array of strings`);
    }
  }
  return value as string[];
};

export const assertTemplateStringMatrix = (
  value: unknown,
  field: string
): string[][] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field}: must be a string[][]`);
  }
  for (let r = 0; r < value.length; r++) {
    const row = value[r];
    if (!Array.isArray(row)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field}: must be a string[][]`);
    }
    for (let c = 0; c < row.length; c++) {
      if (typeof row[c] !== "string") {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field}: must be a string[][]`);
      }
    }
  }
  return value as string[][];
};

export const assertTemplateButtons = (value: unknown): TemplateButton[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "buttons must be an array");
  }

  const out: TemplateButton[] = [];

  for (let i = 0; i < value.length; i++) {
    const raw = value[i];
    if (!raw || typeof raw !== "object") {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `buttons[${i}] is invalid`);
    }
    const row = raw as Record<string, unknown>;
    const typeRaw = row.type;
    if (typeof typeRaw !== "string") {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `buttons[${i}].type is required`);
    }
    const type = typeRaw.trim().toLowerCase();
    if (type !== "quick_reply" && type !== "url" && type !== "phone_number") {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `buttons[${i}].type is invalid`);
    }

    const textRaw = row.text;
    if (typeof textRaw !== "string" || textRaw.trim().length === 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `buttons[${i}].text is required`);
    }
    const text = textRaw.trim();

    if (type === "quick_reply") {
      out.push({ type: "QUICK_REPLY", text });
      continue;
    }

    if (type === "url") {
      const url = row.url;
      if (typeof url !== "string" || url.trim().length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, `buttons[${i}].url is required for type url`);
      }
      const urlEntry: TemplateButton = { type: "URL", text, url: url.trim() };
      const urlTypeRaw = row.url_type;
      if (urlTypeRaw !== undefined && urlTypeRaw !== null) {
        if (typeof urlTypeRaw !== "string") {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, `buttons[${i}].url_type is invalid`);
        }
        const ut = urlTypeRaw.trim().toLowerCase();
        if (ut !== "static" && ut !== "dynamic") {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, `buttons[${i}].url_type is invalid`);
        }
        urlEntry.url_type = ut;
      }
      const example = row.example;
      if (example !== undefined && example !== null) {
        urlEntry.example = assertTemplateStringArray(example, `buttons[${i}].example`);
      }
      out.push(urlEntry);
      continue;
    }

    const pn = row.phone_number;
    if (typeof pn !== "string" || pn.trim().length === 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `buttons[${i}].phone_number is required for type phone_number`
      );
    }
    out.push({
      type: "PHONE_NUMBER",
      text,
      phone_number: parseE164Phone(pn, `buttons[${i}].phone_number`)
    });
  }

  return out;
};

export const mapTemplateSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    name: templates.name,
    language: templates.language,
    category: templates.category,
    status: templates.status,
    createdAt: templates.createdAt,
    updatedAt: templates.updatedAt
  };
  return sortMap[sortBy] ?? templates.createdAt;
};

export const templateNotDeletedCondition = () => ne(templates.status, "deleted");
