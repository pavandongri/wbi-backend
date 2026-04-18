import crypto from "crypto";
import type { Request, Response } from "express";

import { env } from "config/env";
import { CONSTANTS } from "constants/common.constants";
import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import type { AuthUserDetails } from "types/common.types";
import { ApiError } from "utils/api-error.utils";

export type AuthCookiePayload = {
  userId: string;
  companyId: string;
  role: string;
  exp: number; // epoch seconds
  userDetails?: AuthUserDetails;
};

const base64UrlEncode = (input: Buffer | string): string => {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
};

const signHmacSha256Base64Url = (message: string, secret: string): string => {
  return crypto.createHmac("sha256", secret).update(message).digest("base64url");
};

export const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const [rawKey, ...rawValueParts] = part.trim().split("=");
    if (!rawKey) continue;
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();
    if (!value) continue;

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  return cookies;
};

export const getAuthTokenFromRequest = (req: Request): string | null => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[CONSTANTS.AUTH_COOKIE_NAME] ?? null;
};

export const signAuthCookie = (payload: AuthCookiePayload): string => {
  if (!env.AUTH_COOKIE_SECRET) {
    throw new ApiError(500, HTTP_MESSAGES.ERROR.SERVICE_UNAVAILABLE);
  }

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadJson);
  const signature = signHmacSha256Base64Url(payloadB64, env.AUTH_COOKIE_SECRET);
  return `${payloadB64}.${signature}`;
};

export const verifyAuthCookie = (token: string): AuthCookiePayload => {
  if (!env.AUTH_COOKIE_SECRET) {
    throw new ApiError(500, HTTP_MESSAGES.ERROR.SERVICE_UNAVAILABLE);
  }

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
  }

  const expectedSignature = signHmacSha256Base64Url(payloadB64, env.AUTH_COOKIE_SECRET);

  const signatureBuf = Buffer.from(signature, "base64url");
  const expectedBuf = Buffer.from(expectedSignature, "base64url");
  if (signatureBuf.length !== expectedBuf.length) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
  }
  const match = crypto.timingSafeEqual(signatureBuf, expectedBuf);
  if (!match) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
  }

  let payloadJson: string;
  try {
    payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
  }

  let payload: AuthCookiePayload;
  try {
    payload = JSON.parse(payloadJson) as AuthCookiePayload;
  } catch {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
  }

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < nowEpochSeconds) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.TOKEN_EXPIRED);
  }

  if (!payload.userId || !payload.companyId || !payload.role) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
  }

  if (payload.userDetails !== undefined) {
    const ud = payload.userDetails;
    if (ud === null || typeof ud !== "object" || Array.isArray(ud)) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
    }
    const rec = ud as Record<string, unknown>;
    const nameOk = typeof rec.name === "string" && rec.name.trim().length > 0;
    const emailOk = typeof rec.email === "string" && rec.email.trim().length > 0;
    const phone = rec.phone;
    const phoneOk = phone === null || phone === undefined || typeof phone === "string";
    if (!nameOk || !emailOk || !phoneOk) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
    }
  }

  return payload;
};

export const setAuthCookie = (res: Response, token: string): void => {
  const maxAgeSeconds = Math.floor(CONSTANTS.AUTH_COOKIE_MAX_AGE_MS / 1000);
  const secure = env.NODE_ENV === "production";

  const sameSite = "Lax";
  const cookie = [
    `${CONSTANTS.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAgeSeconds}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    secure ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");

  res.setHeader("Set-Cookie", cookie);
};

export const clearAuthCookie = (res: Response): void => {
  const cookie = [
    `${CONSTANTS.AUTH_COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
};
