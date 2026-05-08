import type { Request, Response } from "express";

import { env } from "config/env";
import { HTTP_STATUS } from "constants/http-status.contants";
import { logger } from "logger/app.logger";
import { ApiError } from "utils/api-error.utils";
import { apiSuccessResponse } from "utils/api-response";
import * as webhookService from "../services/webhook.service";

export const exchangeCode = async (req: Request, res: Response): Promise<Response> => {
  const { code, wabaId, phoneNumberId } = req.body;

  if (!code) throw new ApiError(HTTP_STATUS.BAD_REQUEST, "code is required");
  if (!wabaId) throw new ApiError(HTTP_STATUS.BAD_REQUEST, "waba_id is required");
  if (!phoneNumberId) throw new ApiError(HTTP_STATUS.BAD_REQUEST, "phone_number_id is required");

  const result = await webhookService.exchangeCodeAndStoreAssets(
    code,
    wabaId,
    phoneNumberId,
    req.auth!
  );

  return apiSuccessResponse(req, res, {
    data: result,
    message: "WhatsApp Business Account connected successfully",
    statusCode: HTTP_STATUS.OK
  });
};

export const subscribeToWABA = async (req: Request, res: Response): Promise<Response> => {
  const result = await webhookService.subscribeToWABA(req.auth!);

  return apiSuccessResponse(req, res, {
    data: result,
    message: "Webhook configured successfully",
    statusCode: HTTP_STATUS.OK
  });
};

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
          const value: any = change.value;

          // Incoming user messages
          if (value?.messages?.length) {
            // TODO: handle inbound messages
          }

          // Message delivery/read/failure statuses
          if (value?.statuses?.length) {
            // TODO: handle message status updates
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
