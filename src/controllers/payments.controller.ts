import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { ApiError } from "utils/api-error.utils";
import { apiSuccessResponse } from "utils/api-response";
import { getIdParam } from "utils/helpers";
import * as paymentsService from "../services/payments.service";

export const createOrder = async (req: Request, res: Response): Promise<Response> => {
  const result = await paymentsService.createOrder(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const verifyPayment = async (req: Request, res: Response): Promise<Response> => {
  const verified = await paymentsService.verifyPayment(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: verified,
    message: "Payment verified successfully",
    statusCode: HTTP_STATUS.OK
  });
};

export const listPayments = async (req: Request, res: Response): Promise<Response> => {
  const list = await paymentsService.listPayments(req.query as Record<string, unknown>, req.auth!);
  return apiSuccessResponse(req, res, {
    data: list,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const getPaymentById = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const payment = await paymentsService.getPaymentById(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: payment,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const updatePayment = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const updated = await paymentsService.updatePayment(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: updated,
    message: HTTP_MESSAGES.SUCCESS.UPDATED,
    statusCode: HTTP_STATUS.OK
  });
};

export const refundPayment = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const refunded = await paymentsService.refundPayment(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: refunded,
    message: "Refund initiated successfully",
    statusCode: HTTP_STATUS.OK
  });
};

export const handleWebhook = async (req: Request, res: Response): Promise<Response> => {
  const signature = req.headers["x-razorpay-signature"];

  if (typeof signature !== "string") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Missing x-razorpay-signature header");
  }

  if (!req.rawBody) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Missing raw request body");
  }

  await paymentsService.handleWebhook(req.rawBody, signature);

  return apiSuccessResponse(req, res, {
    data: null,
    message: "Webhook processed",
    statusCode: HTTP_STATUS.OK
  });
};
