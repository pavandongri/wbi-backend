import { subscriptionPlans } from "db/schema";

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

export type CreateSubscriptionPlanPayload = {
  name: string;
  code: string;
  description?: string;
  amount: number;
  platformAmount: number;
  messageAmount: number;
  currency?: string;
  interval: "weekly" | "monthly" | "yearly";
  features?: Record<string, any>;
  isActive?: boolean;
};

export type UpdateSubscriptionPlanPayload = Partial<CreateSubscriptionPlanPayload>;
