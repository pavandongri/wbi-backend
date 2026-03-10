import { CONSTANTS } from "constants/common.constants";
import { HTTP_MESSAGES } from "constants/error-messages.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { Request, Response } from "express";

type SuccessOptions = {
  data?: unknown;
  message?: string;
  statusCode?: number;
};

type ErrorOptions = {
  message?: string;
  statusCode?: number;
  errorCode?: string;
};

export const apiSuccessResponse = (
  req: Request,
  res: Response,
  {
    data = null,
    message = HTTP_MESSAGES.SUCCESS.OK,
    statusCode = HTTP_STATUS.OK
  }: SuccessOptions = {}
) => {
  const requestId = req.headers[CONSTANTS.API_REQUEST_ID];

  return res.status(statusCode).json({
    success: true,
    message,
    data,
    requestId
  });
};

export const apiErrorResponse = (
  req: Request,
  res: Response,
  {
    message = HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode
  }: ErrorOptions = {}
) => {
  const requestId = req.headers[CONSTANTS.API_REQUEST_ID];

  return res.status(statusCode).json({
    success: false,
    message,
    requestId,
    ...(errorCode && { errorCode })
  });
};
