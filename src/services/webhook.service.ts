import { createHmac, timingSafeEqual } from "crypto";

import { and, eq } from "drizzle-orm";

import { env } from "config/env";
import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies } from "db/schema";
import { AuthContext } from "types/common.types";
import {
  ExchangeCodeResult,
  FacebookPhoneNumber,
  FacebookTokenResponse
} from "types/webhook.types";
import { ApiError } from "utils/api-error.utils";

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${env.GRAPH_API_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${accessToken}`;
  const res = await fetch(url);
  const data = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || (data as any).error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      (data as any).error?.message ?? "Facebook Graph API error"
    );
  }
  return data;
}

export const exchangeCodeAndStoreAssets = async (
  code: string,
  wabaId: string,
  phoneNumberId: string,
  auth: AuthContext
): Promise<ExchangeCodeResult> => {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, auth.companyId), eq(companies.status, "active")))
    .limit(1);

  if (!company) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  // Step 1: Exchange OAuth code for short-lived user access token
  const shortLivedTokenResponse = await fetch(`${env.GRAPH_API_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.FACEBOOK_APP_ID,
      client_secret: env.FACEBOOK_APP_SECRET,
      code
    })
  });

  const shortLivedTokenData = (await shortLivedTokenResponse.json()) as FacebookTokenResponse;

  if (!shortLivedTokenResponse.ok || shortLivedTokenData.error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      shortLivedTokenData.error?.message ?? "Failed to exchange Facebook OAuth code"
    );
  }

  // Step 2: Exchange short-lived token for long-lived token (60 days)
  const longLivedTokenResponse = await fetch(
    `${env.GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: env.FACEBOOK_APP_ID,
      client_secret: env.FACEBOOK_APP_SECRET,
      fb_exchange_token: shortLivedTokenData.access_token
    }).toString()}`,
    { method: "GET" }
  );

  const longLivedTokenData = (await longLivedTokenResponse.json()) as FacebookTokenResponse;

  if (!longLivedTokenResponse.ok || longLivedTokenData.error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      longLivedTokenData.error?.message ?? "Failed to exchange long-lived Facebook token"
    );
  }

  const accessToken = longLivedTokenData.access_token;

  // Step 3: Fetch phone number display info using the ID provided by Embedded Signup
  const phoneNumber = await graphGet<FacebookPhoneNumber>(
    `/${phoneNumberId}?fields=display_phone_number,verified_name`,
    accessToken
  );

  // Step 4: Persist onboarding details
  await db
    .update(companies)
    .set({
      wabaId,
      whatsappPhoneNumberId: phoneNumberId,
      whatsappAccessToken: accessToken,
      updatedAt: new Date()
    })
    .where(eq(companies.id, auth.companyId));

  return {
    wabaId,
    whatsappPhoneNumberId: phoneNumberId,
    phoneNumber: phoneNumber.display_phone_number
  };
};

export const subscribeToWABA = async (auth: AuthContext): Promise<{ success: boolean }> => {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, auth.companyId), eq(companies.status, "active")))
    .limit(1);

  if (!company) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }

  if (!company.wabaId || !company.whatsappAccessToken) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      "Company does not have WhatsApp Business Account configured. Run exchange-code first."
    );
  }

  // Subscribe the WABA to this app so events flow to our webhook.
  // App-level webhook config (callback URL + verify token) is a one-time setup
  // done in the Facebook Developer Console — no need to repeat it per company.
  const wabaSubRes = await fetch(`${env.GRAPH_API_BASE}/${company.wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${company.whatsappAccessToken}` }
  });

  const wabaSubData = (await wabaSubRes.json()) as {
    success?: boolean;
    error?: { message: string };
  };

  if (!wabaSubRes.ok || wabaSubData.error) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      wabaSubData.error?.message ?? "Failed to subscribe WABA to webhook"
    );
  }

  return { success: true };
};

export const verifyWebhookSignature = (rawBody: Buffer, signature: string): boolean => {
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
