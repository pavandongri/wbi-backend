import { CONSTANTS } from "constants/common.constants";
import { HTTP_MESSAGES } from "constants/http-message.constants";
import { NextFunction, Request, Response } from "express";
import { requestLogger } from "logger/request.logger";
import { apiErrorResponse } from "utils/api-response";
import { HTTP_STATUS } from "../constants/http-status.contants";
import { logger } from "../logger/app.logger";
import { ApiError } from "../utils/api-error.utils";

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.headers[CONSTANTS.API_REQUEST_ID];

  const error =
    err instanceof ApiError
      ? err
      : new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR);

  const logData = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    message: error.message,
    stack: error.stack
  };

  logger.error(logData);
  requestLogger.error(logData);

  return apiErrorResponse(req, res, {
    message: error?.message,
    statusCode: error?.status
  });
};
