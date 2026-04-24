import { messages } from "db/schema";

export type Message = typeof messages.$inferSelect;

export type MessageStatus = "created" | "queued" | "sent" | "delivered" | "read" | "failed";

export type MessageDirection = "inbound" | "outbound";

export type CreateMessagePayload = {
  from: string;
  to: string;
  body?: string | null;
  templateId?: string | null;
  templateHeaderParams?: string | null;
  templateBodyParams?: string[] | null;
  status?: string;
  direction: string;
  failedReason?: string | null;
  userId?: string | null;
  cost?: number | null;
  sentAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  readAt?: string | Date | null;
};

export type UpdateMessagePayload = Partial<
  Pick<
    CreateMessagePayload,
    | "from"
    | "to"
    | "body"
    | "templateId"
    | "templateHeaderParams"
    | "templateBodyParams"
    | "status"
    | "direction"
    | "failedReason"
    | "userId"
    | "cost"
    | "sentAt"
    | "deliveredAt"
    | "readAt"
  >
>;
