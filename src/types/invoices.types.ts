import { invoices } from "db/schema";

export type Invoice = typeof invoices.$inferSelect;

export const validInvoiceStatuses = ["draft", "issued", "paid", "void", "overdue"] as const;
export type InvoiceStatus = (typeof validInvoiceStatuses)[number];

export type CreateInvoicePayload = {
  subscriptionId?: string;
  paymentId?: string;
  taxAmount?: number;
  totalAmount: number;
  currency?: string;
  status?: InvoiceStatus;
  notes?: string;
  pdfUrl?: string;
  dueAt?: string;
};

export type UpdateInvoicePayload = {
  status?: InvoiceStatus;
  notes?: string;
  pdfUrl?: string;
  dueAt?: string;
  paidAt?: string;
};
