import { env } from "config/env";
import { HTTP_STATUS } from "constants/http-status.contants";
import { stripPlus } from "helpers/message.helpers";
import {
  MetaApiResponse,
  MetaCreateButtonItem,
  MetaCreateTemplateComponent,
  MetaCreateTemplateResponse,
  MetaSendPayload,
  MetaSendResult,
  MetaTemplateComponent,
  MetaTemplatePayload,
  MetaTextPayload
} from "types/meta.types";
import { Template } from "types/templates.types";
import { ApiError } from "utils/api-error.utils";
import { getS3ObjectBuffer } from "utils/s3.utils";

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

export async function metaDeleteApiClient<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${env.GRAPH_API_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const data = (await res.json()) as T & { error?: { message: string } };

  if (!res.ok || data.error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data.error?.message ?? "Facebook Graph API error"
    );
  }

  return data;
}

function replaceNamedParams(text: string): string {
  const seen = new Map<string, number>();
  let counter = 1;
  return text.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (_, name: string) => {
    if (!seen.has(name)) seen.set(name, counter++);
    return `{{${seen.get(name)}}}`;
  });
}

function buildTemplateComponents(template: Template): MetaCreateTemplateComponent[] {
  const components: MetaCreateTemplateComponent[] = [];

  if (template.headerType !== "NONE") {
    const header: Record<string, unknown> = {
      type: "HEADER",
      format: template.headerType
    };

    if (template.headerType === "TEXT" && template.headerText) {
      header.text = replaceNamedParams(template.headerText);
      if (template.headerExample?.length) {
        header.example = { header_text: template.headerExample };
      }
    } else if (
      (template.headerType === "IMAGE" ||
        template.headerType === "VIDEO" ||
        template.headerType === "DOCUMENT") &&
      template.headerMediaHandler
    ) {
      header.example = { header_handle: [template.headerMediaHandler] };
    }

    components.push(header as unknown as MetaCreateTemplateComponent);
  }

  const body: Record<string, unknown> = { type: "BODY", text: replaceNamedParams(template.body) };
  if (template.bodyExample?.length) {
    body.example = { body_text: template.bodyExample };
  }
  components.push(body as unknown as MetaCreateTemplateComponent);

  if (template.footer) {
    components.push({ type: "FOOTER", text: template.footer });
  }

  if (template.buttons?.length) {
    const buttons: MetaCreateButtonItem[] = template.buttons.map((btn) => {
      if (btn.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: btn.text };
      if (btn.type === "URL") {
        const b: Record<string, unknown> = { type: "URL", text: btn.text, url: btn.url! };
        if (btn.url_type === "dynamic" && btn.example?.length) b.example = btn.example;
        return b as MetaCreateButtonItem;
      }
      return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone_number! };
    });
    components.push({ type: "BUTTONS", buttons });
  }

  return components;
}

export const submitTemplateToMeta = async (
  wabaId: string,
  accessToken: string,
  template: Template
): Promise<MetaCreateTemplateResponse> => {
  const payload = {
    name: template.name,
    language: template.language,
    category: template.category,
    components: buildTemplateComponents(template) as unknown as Record<string, unknown>[]
  };

  return metaPostApiClient<MetaCreateTemplateResponse>(
    `/${wabaId}/message_templates`,
    accessToken,
    payload
  );
};

export const deleteTemplateFromMeta = async (
  wabaId: string,
  accessToken: string,
  templateName: string
): Promise<void> => {
  await metaDeleteApiClient(`/${wabaId}/message_templates`, accessToken, { name: templateName });
};

export async function metaGetApiClient<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${env.GRAPH_API_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), { method: "GET" });
  const data = (await res.json()) as T & { error?: { message: string } };

  if (!res.ok || data.error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data.error?.message ?? "Facebook Graph API error"
    );
  }

  return data;
}

export type MetaTemplateStatusResult = {
  id: string;
  status: string;
  rejected_reason?: string;
};

export const fetchMetaTemplateStatuses = async (
  metaTemplateIds: string[],
  accessToken: string
): Promise<MetaTemplateStatusResult[]> => {
  const results = await Promise.allSettled(
    metaTemplateIds.map((id) =>
      metaGetApiClient<MetaTemplateStatusResult>(`/${id}`, accessToken, {
        fields: "id,status,rejected_reason"
      })
    )
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
};

export const uploadMediaToMeta = async (
  s3Key: string,
  contentType: string,
  accessToken: string
): Promise<string> => {
  const buffer = await getS3ObjectBuffer(s3Key);
  const filename = s3Key.split("/").pop() ?? "file";

  // Step 1: initiate upload session
  const sessionUrl = new URL(`${env.GRAPH_API_BASE}/${env.FACEBOOK_APP_ID}/uploads`);
  sessionUrl.searchParams.set("file_name", filename);
  sessionUrl.searchParams.set("file_length", String(buffer.byteLength));
  sessionUrl.searchParams.set("file_type", contentType);

  const sessionRes = await fetch(sessionUrl.toString(), {
    method: "POST",
    headers: { Authorization: `OAuth ${accessToken}` }
  });

  const sessionData = (await sessionRes.json()) as { id?: string; error?: { message: string } };

  if (!sessionRes.ok || sessionData.error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      sessionData.error?.message ?? "Meta upload session creation failed"
    );
  }

  const uploadSessionId = sessionData.id;
  if (!uploadSessionId) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Meta did not return an upload session id"
    );
  }

  // Step 2: upload file bytes to the session
  const uploadRes = await fetch(`${env.GRAPH_API_BASE}/${uploadSessionId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream"
    },
    body: new Uint8Array(buffer)
  });

  const uploadData = (await uploadRes.json()) as { h?: string; error?: { message: string } };

  if (!uploadRes.ok || uploadData.error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      uploadData.error?.message ?? "Meta file upload failed"
    );
  }

  if (!uploadData.h) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Meta did not return a file handle");
  }

  return uploadData.h;
};
