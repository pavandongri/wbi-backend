import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { apiSuccessResponse } from "utils/api-response";
import { getIdParam } from "utils/helpers";
import * as messagesService from "../services/messages.service";

export const createMessage = async (req: Request, res: Response): Promise<Response> => {
  const created = await messagesService.createMessage(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: created,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const listMessages = async (req: Request, res: Response): Promise<Response> => {
  const list = await messagesService.listMessages(req.query as Record<string, unknown>, req.auth!);
  return apiSuccessResponse(req, res, {
    data: list,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const getMessageById = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const row = await messagesService.getMessageById(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: row,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const updateMessage = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const updated = await messagesService.updateMessage(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: updated,
    message: HTTP_MESSAGES.SUCCESS.UPDATED,
    statusCode: HTTP_STATUS.OK
  });
};

export const deleteMessage = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const result = await messagesService.deleteMessage(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.DELETED,
    statusCode: HTTP_STATUS.OK
  });
};
