export type MessageStatus =
  | "created"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "received";

export const MESSAGE_STATUSES: readonly MessageStatus[] = [
  "created",
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "received"
];

export type MessageDirection = "inbound" | "outbound";

export const MESSAGE_DIRECTIONS: readonly MessageDirection[] = ["inbound", "outbound"];

export type MessageType = "marketing" | "authentication" | "utility" | "text";

export const MESSAGE_TYPES: readonly MessageType[] = [
  "marketing",
  "authentication",
  "utility",
  "text"
];
