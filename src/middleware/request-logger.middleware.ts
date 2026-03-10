import { CONSTANTS } from "constants/common.constants";
import { NextFunction, Request, Response } from "express";
import { requestLogger } from "../logger/request.logger";

export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers[CONSTANTS.API_REQUEST_ID];

  requestLogger.info({
    requestId,
    method: req.method,
    url: req.originalUrl
  });

  res.on("finish", () => {
    const duration = Date.now() - start;

    requestLogger.info({
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};
