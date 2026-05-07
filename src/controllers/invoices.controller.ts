import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { apiSuccessResponse } from "utils/api-response";
import { getIdParam } from "utils/helpers";
import * as invoicesService from "../services/invoices.service";

export const createInvoice = async (req: Request, res: Response): Promise<Response> => {
  const created = await invoicesService.createInvoice(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: created,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const listInvoices = async (req: Request, res: Response): Promise<Response> => {
  const list = await invoicesService.listInvoices(req.query as Record<string, unknown>, req.auth!);
  return apiSuccessResponse(req, res, {
    data: list,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const getInvoiceById = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const invoice = await invoicesService.getInvoiceById(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: invoice,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const updateInvoice = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const updated = await invoicesService.updateInvoice(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: updated,
    message: HTTP_MESSAGES.SUCCESS.UPDATED,
    statusCode: HTTP_STATUS.OK
  });
};
