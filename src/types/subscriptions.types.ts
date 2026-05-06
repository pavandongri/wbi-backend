import { subscriptions } from "db/schema";

export type Subscription = typeof subscriptions.$inferSelect;

export type CreateSubscriptionPayload = {
  planId: string;
  status?: "active" | "cancelled" | "expired" | "scheduled";
  discount?: number;
  startDate?: string;
  endDate?: string;
};

export type UpdateSubscriptionPayload = {
  status?: "active" | "cancelled" | "expired" | "scheduled";
  discount?: number;
  startDate?: string;
  endDate?: string;
};

export const validStatuses = ["active", "cancelled", "expired", "scheduled"] as const;
