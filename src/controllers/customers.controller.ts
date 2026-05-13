import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { apiSuccessResponse } from "utils/api-response";
import { getIdParam } from "utils/helpers";
import * as customersService from "../services/customers.service";

export const createCustomer = async (req: Request, res: Response): Promise<Response> => {
  const created = await customersService.createCustomer(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: created,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const createCustomerExternal = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body as Record<string, unknown>;
  const created = await customersService.createCustomerExternal({
    name: body.name as string,
    phone: body.phone as string,
    email: body.email as string | undefined,
    city: body.city as string | undefined,
    state: body.state as string | undefined,
    country: body.country as string | undefined,
    zipcode: body.zipcode as string | undefined,
    address: body.address as string | undefined,
    tags: body.tags,
    companyId: req.params.companyId as string
  });

  return apiSuccessResponse(req, res, {
    data: created,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const listCustomers = async (req: Request, res: Response): Promise<Response> => {
  const list = await customersService.listCustomers(
    req.query as Record<string, unknown>,
    req.auth!
  );
  return apiSuccessResponse(req, res, {
    data: list,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const getCustomerById = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const customer = await customersService.getCustomerById(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: customer,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const updateCustomer = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const updated = await customersService.updateCustomer(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: updated,
    message: HTTP_MESSAGES.SUCCESS.UPDATED,
    statusCode: HTTP_STATUS.OK
  });
};

export const deleteCustomer = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const result = await customersService.deleteCustomer(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.DELETED,
    statusCode: HTTP_STATUS.OK
  });
};
