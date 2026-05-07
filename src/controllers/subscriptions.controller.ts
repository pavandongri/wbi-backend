import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { apiSuccessResponse } from "utils/api-response";
import { getIdParam } from "utils/helpers";
import * as subscriptionsService from "../services/subscriptions.service";

export const createSubscription = async (req: Request, res: Response): Promise<Response> => {
  const created = await subscriptionsService.createSubscription(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: created,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const listSubscriptions = async (req: Request, res: Response): Promise<Response> => {
  const list = await subscriptionsService.listSubscriptions(
    req.query as Record<string, unknown>,
    req.auth!
  );
  return apiSuccessResponse(req, res, {
    data: list,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const getSubscriptionById = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const sub = await subscriptionsService.getSubscriptionById(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: sub,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const updateSubscription = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const updated = await subscriptionsService.updateSubscription(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: updated,
    message: HTTP_MESSAGES.SUCCESS.UPDATED,
    statusCode: HTTP_STATUS.OK
  });
};

export const deleteSubscription = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const result = await subscriptionsService.deleteSubscription(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.DELETED,
    statusCode: HTTP_STATUS.OK
  });
};
