import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { apiSuccessResponse } from "utils/api-response";
import { getIdParam } from "utils/helpers";
import * as mappingsService from "../services/customer-group-mappings.service";

export const createCustomerGroupMapping = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const created = await mappingsService.createCustomerGroupMapping(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: created,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const listCustomerGroupMappings = async (req: Request, res: Response): Promise<Response> => {
  const list = await mappingsService.listCustomerGroupMappings(
    req.query as Record<string, unknown>,
    req.auth!
  );
  return apiSuccessResponse(req, res, {
    data: list,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const getCustomerGroupMappingById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const mapping = await mappingsService.getCustomerGroupMappingById(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: mapping,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const updateCustomerGroupMapping = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const updated = await mappingsService.updateCustomerGroupMapping(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: updated,
    message: HTTP_MESSAGES.SUCCESS.UPDATED,
    statusCode: HTTP_STATUS.OK
  });
};

export const deleteCustomerGroupMapping = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const result = await mappingsService.deleteCustomerGroupMapping(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.DELETED,
    statusCode: HTTP_STATUS.OK
  });
};
