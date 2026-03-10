import { CONSTANTS } from "constants/common.constants";
import { NextFunction, Request, Response } from "express";
import { v4 as uuid } from "uuid";

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuid();

  req.headers[CONSTANTS.API_REQUEST_ID] = requestId;

  res.setHeader(CONSTANTS.API_REQUEST_ID, requestId);

  next();
};
