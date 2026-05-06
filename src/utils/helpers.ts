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
  // 🔑 Drizzle wraps the actual PG error inside `cause`
  const e = (err as any)?.cause ?? err;

  if (typeof e === "object" && e) {
    const pgErr = e as {
      code?: string;
      detail?: string;
      column?: string;
      constraint?: string;
    };

    // 🔴 UNIQUE VIOLATION
    if (pgErr.code === "23505") {
      let field = "field";

      // Extract from: Key (email)=(...)
      const match = pgErr.detail?.match(/Key \(([^)]+)\)=/);
      if (match?.[1]) {
        field = match[1];
      }
      // fallback: users_email_key → email
      else if (pgErr.constraint) {
        const parts = pgErr.constraint.split("_");
        if (parts.length >= 2) {
          field = parts[1];
        }
      }

      const fieldMap: Record<string, string> = {
        email: "Email",
        phone: "Phone number"
      };

      const readableField = fieldMap[field] ?? field;

      throw new ApiError(HTTP_STATUS.CONFLICT, `${readableField} already in use`);
    }

    // 🟡 FK
    if (pgErr.code === "23503") {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Referenced record does not exist");
    }

    // 🟠 NOT NULL
    if (pgErr.code === "23502") {
      const field = pgErr.column ?? "field";
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field} is required`);
    }
  }

  // ❗ fallback
  throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Something went wrong");
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

export const requireSuperAdmin = (auth: AuthContext): void => {
  if (!isSuperAdmin(auth.role)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Only super_admins can access this resource");
  }
};

export const requireAdmin = (auth: AuthContext): void => {
  if (!isAdmin(auth.role)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Only admins can access this resource");
  }
};

export const requireAdminOrSuperAdmin = (auth: AuthContext): void => {
  if (!isAdminOrHigher(auth.role)) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      "Only admins and  super_admins can access this resource"
    );
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

export function validateRequiredFields(payload: any, requiredFields: string[] = []) {
  const missingFields = requiredFields.filter((field) => {
    return !getValue(payload, field);
  });

  if (missingFields.length > 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `missing [${missingFields.join(", ")}]`);
  }
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
