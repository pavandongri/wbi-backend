import type { TemplateCategory, TemplateHeaderType, TemplateStatus } from "types/templates.types";

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = ["marketing", "utility"];

export const TEMPLATE_HEADER_TYPES: readonly TemplateHeaderType[] = [
  "text",
  "image",
  "video",
  "document",
  "location",
  "none"
];

export const TEMPLATE_STATUSES: readonly TemplateStatus[] = [
  "pending",
  "approved",
  "rejected",
  "deleted"
];

export const PATCHABLE_STATUSES: readonly TemplateStatus[] = ["pending", "approved", "rejected"];
