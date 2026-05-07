import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { apiSuccessResponse } from "utils/api-response";
import { getIdParam } from "utils/helpers";
import * as templatesService from "../services/templates.service";

export const createTemplate = async (req: Request, res: Response): Promise<Response> => {
  const created = await templatesService.createTemplate(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: created,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const listTemplates = async (req: Request, res: Response): Promise<Response> => {
  const list = await templatesService.listTemplates(
    req.query as Record<string, unknown>,
    req.auth!
  );
  return apiSuccessResponse(req, res, {
    data: list,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const getTemplateById = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const row = await templatesService.getTemplateById(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: row,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const updateTemplate = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const updated = await templatesService.updateTemplate(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: updated,
    message: HTTP_MESSAGES.SUCCESS.UPDATED,
    statusCode: HTTP_STATUS.OK
  });
};

export const deleteTemplate = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const result = await templatesService.deleteTemplate(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.DELETED,
    statusCode: HTTP_STATUS.OK
  });
};
