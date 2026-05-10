import { messages } from "db/schema";

export type { MessageDirection, MessageStatus, MessageType } from "constants/message.constants";

export type Message = typeof messages.$inferSelect;

export type CreateMessagePayload = {
  from: string;
  to: string;
  body?: string | null;
  templateId?: string | null;
  templateHeaderParams?: string | null;
  templateBodyParams?: string[] | null;
  messageType?: string | null;
  status?: string;
  failedReason?: string | null;
  userId?: string | null;
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
    | "messageType"
    | "status"
    | "failedReason"
    | "userId"
    | "sentAt"
    | "deliveredAt"
    | "readAt"
  >
>;
