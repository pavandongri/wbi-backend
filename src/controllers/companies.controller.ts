import type { Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { ApiError } from "utils/api-error.utils";
import { apiSuccessResponse } from "utils/api-response";
import { getIdParam } from "utils/helpers";
import * as companiesService from "../services/companies.service";

export const createCompany = async (req: Request, res: Response): Promise<Response> => {
  const company = await companiesService.createCompany(req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: company,
    message: HTTP_MESSAGES.SUCCESS.CREATED,
    statusCode: HTTP_STATUS.CREATED
  });
};

export const listCompanies = async (req: Request, res: Response): Promise<Response> => {
  const list = await companiesService.listCompanies(
    req.query as Record<string, unknown>,
    req.auth!
  );
  return apiSuccessResponse(req, res, {
    data: list,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const getCompanyById = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const company = await companiesService.getCompanyById(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: company,
    message: HTTP_MESSAGES.SUCCESS.DATA_FETCHED,
    statusCode: HTTP_STATUS.OK
  });
};

export const updateCompany = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const updated = await companiesService.updateCompany(id, req.body, req.auth!);
  return apiSuccessResponse(req, res, {
    data: updated,
    message: HTTP_MESSAGES.SUCCESS.UPDATED,
    statusCode: HTTP_STATUS.OK
  });
};

export const deleteCompany = async (req: Request, res: Response): Promise<Response> => {
  const id = getIdParam(req.params.id);
  const result = await companiesService.deleteCompany(id, req.auth!);
  return apiSuccessResponse(req, res, {
    data: result,
    message: HTTP_MESSAGES.SUCCESS.DELETED,
    statusCode: HTTP_STATUS.OK
  });
};

export const exchangeCode = async (req: Request, res: Response): Promise<Response> => {
  const { code, wabaId, phoneNumberId } = req.body;

  if (!code) throw new ApiError(HTTP_STATUS.BAD_REQUEST, "code is required");
  if (!wabaId) throw new ApiError(HTTP_STATUS.BAD_REQUEST, "waba_id is required");
  if (!phoneNumberId) throw new ApiError(HTTP_STATUS.BAD_REQUEST, "phone_number_id is required");

  const result = await companiesService.exchangeCodeAndStoreAssets(
    code,
    wabaId,
    phoneNumberId,
    req.auth!
  );

  return apiSuccessResponse(req, res, {
    data: result,
    message: "WhatsApp Business Account connected successfully",
    statusCode: HTTP_STATUS.OK
  });
};
