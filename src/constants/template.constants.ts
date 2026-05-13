import type { TemplateCategory, TemplateHeaderType, TemplateStatus } from "types/templates.types";

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = ["MARKETING", "UTILITY"];

export const TEMPLATE_HEADER_TYPES: readonly TemplateHeaderType[] = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "LOCATION",
  "NONE"
];

export const TEMPLATE_STATUSES: readonly TemplateStatus[] = [
  "pending",
  "approved",
  "rejected",
  "deleted"
];

export const PATCHABLE_STATUSES: readonly TemplateStatus[] = ["pending", "approved", "rejected"];
