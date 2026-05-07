import type { MessageDirection, MessageStatus } from "types/messages.types";

export const MESSAGE_STATUSES: readonly MessageStatus[] = [
  "created",
  "queued",
  "sent",
  "delivered",
  "read",
  "failed"
];

export const MESSAGE_DIRECTIONS: readonly MessageDirection[] = ["inbound", "outbound"];
