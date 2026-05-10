import type { Request, Response } from "express";

import { env } from "config/env";
import { logger } from "logger/app.logger";
import { WhatsAppMessagesValue } from "types/webhook.types";
import * as webhookService from "../services/webhook.service";

// GET /api/v1/webhooks/whatsapp — Facebook webhook verification
export const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }

  res.status(403).send("Forbidden");
};

// POST /api/v1/webhooks/whatsapp — incoming WhatsApp events
// - Facebook/WhatsApp may retry webhook delivery multiple times.
// - Webhook processing must be idempotent.
// - Deduplicate incoming messages using the WhatsApp message ID (`messages[].id`, also called `wamid`).
// - Store processed webhook/message IDs to avoid duplicate processing.
// - Always return HTTP 200 quickly after receiving the event.
export const handleWebhook = (req: Request, res: Response): void => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;

  if (!signature) {
    res.status(401).send("Missing signature");
    return;
  }

  const rawBody: Buffer = (req as any).rawBody;
  if (!webhookService.verifyWebhookSignature(rawBody, signature)) {
    res.status(401).send("Invalid signature");
    return;
  }

  const body = req.body as {
    object?: string;
    entry?: Array<{
      id: string;
      changes: Array<{
        field: string;
        value: unknown;
      }>;
    }>;
  };

  logger.info("WhatsApp webhook received", { body });

  // Acknowledge immediately; process asynchronously as needed
  res.status(200).send("EVENT_RECEIVED");

  if (body.object !== "whatsapp_business_account") return;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      switch (change.field) {
        case "messages": {
          const value: WhatsAppMessagesValue = change.value as WhatsAppMessagesValue;

          if (value?.messages?.length) {
            webhookService.handleInboundMessages(value).catch((err) => {
              logger.error("handleInboundMessages failed", { err });
            });
          }

          if (value?.statuses?.length) {
            webhookService.handleMessageStatusUpdates(value.statuses).catch((err) => {
              logger.error("handleMessageStatusUpdates failed", { err });
            });
          }

          break;
        }

        case "message_template_status_update": {
          // TODO: handle template approval/rejection/disable events
          break;
        }

        case "phone_number_name_update": {
          // TODO: handle phone display name updates
          break;
        }

        case "account_update": {
          // TODO: handle WABA account updates
          break;
        }

        case "business_capability_update": {
          // TODO: handle capability/limit updates
          break;
        }

        case "security": {
          // TODO: handle security-related events
          break;
        }

        default: {
          logger.warn("Unhandled WhatsApp webhook event", {
            field: change.field,
            value: change.value
          });
        }
      }
    }
  }
};
