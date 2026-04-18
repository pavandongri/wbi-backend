import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import * as authService from "services/auth.service";
import { ApiError } from "utils/api-error.utils";
import { apiSuccessResponse } from "utils/api-response";
import { clearAuthCookie, setAuthCookie, signAuthCookie } from "utils/cookie.utils";
import { requireNonEmptyString } from "utils/helpers";

export const signup = async (req: Request, res: Response): Promise<Response> => {
  const { companyName, companyPhone, companyEmail, name, email, password } = req.body ?? {};

  if (
    !requireNonEmptyString(companyName) ||
    !requireNonEmptyString(companyPhone) ||
    !requireNonEmptyString(name) ||
    !requireNonEmptyString(email) ||
    !requireNonEmptyString(password)
  ) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  const companyEmailTrimmed =
    typeof companyEmail === "string" && companyEmail.trim().length > 0
      ? companyEmail.trim()
      : undefined;

  const { userId, companyId, role, userDetails } = await authService.signup({
    companyName: companyName.trim(),
    companyPhone: companyPhone.trim(),
    companyEmail: companyEmailTrimmed,
    name: name.trim(),
    email: email.trim(),
    password
  });

  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const token = signAuthCookie({ userId, companyId, role, exp, userDetails });

  setAuthCookie(res, token);

  return apiSuccessResponse(req, res, {
    data: { userId, companyId, role, userDetails },
    message: HTTP_MESSAGES.SUCCESS.SIGNUP_SUCCESS,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body ?? {};

  if (!requireNonEmptyString(email) || !requireNonEmptyString(password)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }

  const { userId, companyId, role, userDetails } = await authService.login({
    email: email.trim(),
    password
  });

  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = signAuthCookie({ userId, companyId, role, exp, userDetails });

  setAuthCookie(res, token);

  return apiSuccessResponse(req, res, {
    data: { userId, companyId, role, userDetails },
    message: HTTP_MESSAGES.SUCCESS.LOGIN_SUCCESS,
    statusCode: HTTP_STATUS.OK
  });
};

export const logout = (req: Request, res: Response): Response => {
  clearAuthCookie(res);
  return apiSuccessResponse(req, res, {
    data: null,
    message: HTTP_MESSAGES.SUCCESS.LOGOUT_SUCCESS,
    statusCode: HTTP_STATUS.OK
  });
};

export const me = async (req: Request, res: Response): Promise<Response> => {
  if (!req.auth?.userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.UNAUTHORIZED);
  }

  const me = await authService.getMe(req.auth.userId);

  return apiSuccessResponse(req, res, {
    data: me,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};
