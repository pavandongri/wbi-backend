import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import * as mediaService from "services/media.service";
import { apiSuccessResponse } from "utils/api-response";

export const presignUpload = async (req: Request, res: Response): Promise<Response> => {
  const result = await mediaService.getPresignedUploadUrl(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.OK,
    statusCode: HTTP_STATUS.OK
  });
};

export const metaUpload = async (req: Request, res: Response): Promise<Response> => {
  const result = await mediaService.getMetaMediaHandle(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.OK,
    statusCode: HTTP_STATUS.OK
  });
};
