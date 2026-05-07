import { payments } from "db/schema";

export type Payment = typeof payments.$inferSelect;

export const validPaymentTypes = ["subscription", "message_credits"] as const;
export type PaymentType = (typeof validPaymentTypes)[number];

export const validPaymentStatuses = [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded"
] as const;
export type PaymentStatus = (typeof validPaymentStatuses)[number];

export type CreateOrderPayload = {
  type: PaymentType;
  amount: number;
  currency?: string;
  subscriptionId?: string;
  subscriptionPlanId?: string;
};

export type VerifyPaymentPayload = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export type UpdatePaymentPayload = {
  status?: PaymentStatus;
  paymentMethod?: string;
  failureReason?: string;
};

export type RefundPaymentPayload = {
  amount?: number;
  reason?: string;
};
