import bcrypt from "bcrypt";
import { CONSTANTS, ROLES } from "constants/common.constants";
import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db";
import { customerCompanyMappings } from "db/schema";
import { and, eq } from "drizzle-orm";
import { AuthContext } from "types/common.types";
import { ApiError } from "./api-error.utils";

export const requireNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const handleUniqueViolation = (err: unknown): never => {
  const code = typeof err === "object" && err ? (err as { code?: string }).code : undefined;
  if (code === "23505") {
    throw new ApiError(409, HTTP_MESSAGES.ERROR.DUPLICATE_RESOURCE);
  }
  throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, getErrorMessage(err));
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message ?? "Unknown API error";
  }

  if (error instanceof Error) {
    return error.message ?? "Unknown error";
  }

  return "Unknown error";
};

export const getIdParam = (value: string | string[] | undefined): string => {
  if (typeof value !== "string") {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, HTTP_MESSAGES.ERROR.BAD_REQUEST);
  }
  return value;
};

export const assertCompanyScope = (auth: AuthContext, companyId: string): void => {
  if (auth.role !== "super_admin" && companyId !== auth.companyId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, HTTP_MESSAGES.ERROR.FORBIDDEN);
  }
};

export const ensureCustomerMappedToCompany = async (
  customerId: string,
  companyId: string
): Promise<void> => {
  const rows = await db
    .select({ id: customerCompanyMappings.id })
    .from(customerCompanyMappings)
    .where(
      and(
        eq(customerCompanyMappings.customerId, customerId),
        eq(customerCompanyMappings.companyId, companyId)
      )
    )
    .limit(1);

  if (!rows[0]) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, HTTP_MESSAGES.ERROR.NOT_FOUND);
  }
};

export const isSuperAdmin = (role: string): boolean => role === ROLES.SUPER_ADMIN;

export const isAdmin = (role: string): boolean => role === ROLES.ADMIN;

export const isStaff = (role: string): boolean => role === ROLES.STAFF;

export const isAdminOrHigher = (role: string): boolean => isSuperAdmin(role) || isAdmin(role);

export const isStaffOrHigher = (role: string): boolean =>
  isSuperAdmin(role) || isAdmin(role) || isStaff(role);

export function getValue(obj: any, path: string): boolean {
  const found = path.split(".").reduce((acc, key) => acc?.[key], obj);
  return found !== undefined && found !== null && found !== "";
}

export function getMissingFields(payload: any, fields: string[]): string[] {
  return fields.filter((field) => !getValue(payload, field)).map((field) => `${field} is required`);
}

export const sleeper = {
  sleep: (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
};

export const hashPassword = async (password: string): Promise<string> => {
  if (!password) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Password is required");
  }

  const salt = await bcrypt.genSalt(CONSTANTS.SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);

  return hash;
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};
