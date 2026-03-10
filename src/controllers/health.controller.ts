import { Request, Response } from "express";
import { HTTP_STATUS } from "../constants/http-status.contants";
import * as healthService from "../services/health.service";
import { apiSuccessResponse } from "../utils/api-response";

export const getHealth = (req: Request, res: Response) => {
  const data = healthService.getHealth();

  return apiSuccessResponse(req, res, {
    data,
    message: "healthy..",
    statusCode: HTTP_STATUS.OK
  });
};
