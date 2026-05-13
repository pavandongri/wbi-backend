import { templates } from "db/schema";

export type Template = typeof templates.$inferSelect;

export type TemplateCategory = "MARKETING" | "UTILITY";

export type TemplateHeaderType = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | "NONE";

export type TemplateStatus = "pending" | "approved" | "rejected" | "deleted";

export type TemplateButton = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  url_type?: "static" | "dynamic";
  phone_number?: string;
  example?: string[];
};

export type CreateTemplatePayload = {
  name: string;
  language: string;
  category: string;
  headerType: string;
  headerText?: string | null;
  headerMediaUrl?: string | null;
  headerMediaHandler?: string | null;
  headerExample?: string[] | null;
  body: string;
  bodyExample?: string[][] | null;
  footer?: string | null;
  buttons?: TemplateButton[] | null;
  rejectionMessage?: string | null;
};
