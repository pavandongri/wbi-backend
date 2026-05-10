import { createHmac, timingSafeEqual } from "crypto";

import { eq } from "drizzle-orm";

import { env } from "config/env";
import { db } from "db/index";
import { companies, messages } from "db/schema";
import { logger } from "logger/app.logger";
import { WhatsAppMessageStatus, WhatsAppMessagesValue } from "types/webhook.types";

export const verifyWebhookSignature = (rawBody: Buffer, signature: string): boolean => {
  logger.info("Verifying webhook signature");

  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const receivedSignature = signature.replace("sha256=", "");

  const expectedSignature = createHmac("sha256", env.FACEBOOK_APP_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(receivedSignature, "hex")
    );
  } catch {
    return false;
  }
};

export const handleMessageStatusUpdates = async (
  statuses: WhatsAppMessageStatus[]
): Promise<void> => {
  const updates: {
    wamid: string;
    updateFields: Record<string, unknown>;
  }[] = [];

  const statusMap: Record<
    WhatsAppMessageStatus["status"],
    "sent" | "delivered" | "read" | "failed"
  > = {
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed"
  };

  for (const update of statuses) {
    const { id: wamid, status, timestamp, errors } = update;

    const newStatus = statusMap[status];
    if (!newStatus) continue;

    const ts = timestamp ? new Date(parseInt(timestamp, 10) * 1000) : new Date();

    const updateFields: Record<string, unknown> = {
      status: newStatus
    };

    if (newStatus === "sent") {
      updateFields.sentAt = ts;
    }

    if (newStatus === "delivered") {
      updateFields.deliveredAt = ts;
    }

    if (newStatus === "read") {
      updateFields.readAt = ts;
    }

    if (newStatus === "failed") {
      updateFields.failedReason = errors?.[0]?.title ?? "Delivery failed";
    }

    updates.push({
      wamid,
      updateFields
    });
  }

  if (!updates.length) return;

  try {
    await db.transaction(async (tx) => {
      await Promise.all(
        updates.map(({ wamid, updateFields }) =>
          tx.update(messages).set(updateFields).where(eq(messages.wamid, wamid))
        )
      );
    });
    logger.info("Batch updated message statuses from webhook", { count: updates.length });
  } catch (err) {
    logger.error("Failed to batch update message statuses from webhook", {
      err
    });
  }
};

export const handleInboundMessages = async (value: WhatsAppMessagesValue): Promise<void> => {
  const inbound = value.messages;
  if (!inbound?.length) return;

  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) return;

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.whatsappPhoneNumberId, phoneNumberId))
    .limit(1);

  if (!company) {
    logger.warn("Received inbound message for unknown phone_number_id", { phoneNumberId });
    return;
  }

  const insertableMessages: (typeof messages.$inferInsert)[] = [];

  for (const msg of inbound) {
    if (msg.type !== "text" || !msg.text?.body) continue;

    const from = msg.from.startsWith("+") ? msg.from : `+${msg.from}`;

    const sentAt = msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date();

    insertableMessages.push({
      companyId: company.id,
      from,
      to: company.phone,
      body: msg.text.body,
      direction: "inbound",
      messageType: "text",
      status: "received",
      cost: 0,
      sentAt
    });
  }

  if (insertableMessages.length > 0) {
    try {
      await db.insert(messages).values(insertableMessages);
      logger.info("Saved inbound messages batch", {
        count: insertableMessages.length,
        companyId: company.id
      });
    } catch (err) {
      logger.error("Failed to save inbound messages batch", {
        err,
        companyId: company.id
      });
    }
  }
};
