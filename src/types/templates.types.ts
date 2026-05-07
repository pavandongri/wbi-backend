import { templates } from "db/schema";

export type Template = typeof templates.$inferSelect;

export type TemplateCategory = "marketing" | "utility";

export type TemplateHeaderType = "text" | "image" | "video" | "document" | "location" | "none";

export type TemplateStatus = "pending" | "approved" | "rejected" | "deleted";

export type TemplateButton = {
  type: "quick_reply" | "url" | "phone_number";
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

export type UpdateTemplatePayload = Partial<CreateTemplatePayload> & {
  status?: string;
};
