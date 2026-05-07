import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { apiSuccessResponse } from "utils/api-response";
import { getIdParam } from "utils/helpers";
import * as subscriptionPlansService from "../services/subscription-plans.service";

export const createSubscriptionPlan = async (req: Request, res: Response): Promise<Response> => {
  const created = await subscriptionPlansService.createSubscriptionPlan(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: created,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const listSubscriptionPlans = async (req: Request, res: Response): Promise<Response> => {
  const list = await subscriptionPlansService.listSubscriptionPlans(
    req.query as Record<string, unknown>,
    req.auth!
  );
  return apiSuccessResponse(req, res, {
    data: list,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const getSubscriptionPlanById = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const plan = await subscriptionPlansService.getSubscriptionPlanById(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: plan,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const updateSubscriptionPlan = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const updated = await subscriptionPlansService.updateSubscriptionPlan(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: updated,
    message: HTTP_MESSAGES.SUCCESS.UPDATED,
    statusCode: HTTP_STATUS.OK
  });
};

export const deleteSubscriptionPlan = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const result = await subscriptionPlansService.deleteSubscriptionPlan(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.DELETED,
    statusCode: HTTP_STATUS.OK
  });
};
