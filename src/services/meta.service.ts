import { env } from "config/env";
import { HTTP_STATUS } from "constants/http-status.contants";
import { stripPlus } from "helpers/message.helpers";
import {
  MetaApiResponse,
  MetaSendPayload,
  MetaSendResult,
  MetaTemplateComponent,
  MetaTemplatePayload,
  MetaTextPayload
} from "types/meta.types";
import { ApiError } from "utils/api-error.utils";

export async function metaPostApiClient<T>(
  path: string,
  accessToken: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${env.GRAPH_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = (await res.json()) as T & {
    error?: { message: string };
  };

  if (!res.ok || data.error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data.error?.message ?? "Facebook Graph API error"
    );
  }

  return data;
}

async function callMetaMessagesApi(
  phoneNumberId: string,
  accessToken: string,
  payload: MetaSendPayload
): Promise<MetaSendResult> {
  const url = `${env.GRAPH_API_BASE}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  const data = (await res.json()) as MetaApiResponse;

  if (!res.ok || data.error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data.error?.message ?? "WhatsApp API error"
    );
  }

  const wamid = data.messages?.[0]?.id;
  if (!wamid) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "WhatsApp API did not return message id");
  }

  return { messageId: wamid };
}

export const sendTextMessage = async (
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string
): Promise<MetaSendResult> => {
  const payload: MetaTextPayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: stripPlus(to),
    type: "text",
    text: { body }
  };
  return callMetaMessagesApi(phoneNumberId, accessToken, payload);
};

export const sendTemplateMessage = async (
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  templateLanguage: string,
  headerParam: string | null,
  bodyParams: string[] | null
): Promise<MetaSendResult> => {
  const components: MetaTemplateComponent[] = [];

  if (headerParam) {
    components.push({
      type: "header",
      parameters: [{ type: "text", text: headerParam }]
    });
  }

  if (bodyParams && bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((p) => ({ type: "text", text: p }))
    });
  }

  const payload: MetaTemplatePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: stripPlus(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components
    }
  };

  return callMetaMessagesApi(phoneNumberId, accessToken, payload);
};
