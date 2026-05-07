import { ROLES } from "constants/common.constants";
import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies, users } from "db/schema";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { LoginPayload, SignupPayload } from "types/auth.types";
import { ApiError } from "utils/api-error.utils";
import { comparePassword, handleUniqueViolation, hashPassword } from "utils/helpers";

export const login = async (
  payload: LoginPayload
): Promise<{
  userId: string;
  companyId: string;
  companyPhone: string | null;
  messageCredits: number;
  role: string;
  userDetails: { name: string; email: string; phone: string | null };
}> => {
  const userRows = await db
    .select({
      id: users.id,
      companyId: users.companyId,
      role: users.role,
      name: users.name,
      email: users.email,
      phone: users.phone,
      password: users.password
    })
    .from(users)
    .where(and(eq(users.email, payload.email), eq(users.status, "active")))
    .limit(1);

  const user = userRows[0];

  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_CREDENTIALS);
  }

  const isPasswordValid = await comparePassword(payload.password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_CREDENTIALS);
  }

  const companyRows = await db
    .select({
      id: companies.id,
      status: companies.status,
      phone: companies.phone,
      messageCredits: companies.messageCredits
    })
    .from(companies)
    .where(and(eq(companies.id, user.companyId), eq(companies.status, "active")))
    .limit(1);

  const company = companyRows[0];
  if (!company) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, HTTP_MESSAGES.ERROR.INVALID_COMPANY_ID);
  }

  return {
    userId: user.id,
    companyId: user.companyId,
    companyPhone: company.phone ?? null,
    messageCredits: company.messageCredits ?? 0,
    role: user.role,
    userDetails: {
      name: user.name,
      email: user.email,
      phone: user.phone ?? null
    }
  };
};

export const signup = async (
  payload: SignupPayload
): Promise<{
  userId: string;
  companyId: string;
  companyPhone: string;
  messageCredits: number;
  role: string;
  userDetails: { name: string; email: string; phone: string | null };
}> => {
  const userId = randomUUID();

  try {
    return await db.transaction(async (tx) => {
      const companyRows = await tx
        .insert(companies)
        .values({
          name: payload.companyName,
          phone: payload.companyPhone,
          email: payload.companyEmail,

          category: payload.category,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          zipcode: payload.zipcode,

          status: "active"
        })
        .returning({
          id: companies.id,
          phone: companies.phone,
          messageCredits: companies.messageCredits
        });

      const company = companyRows[0];
      if (!company) {
        throw new ApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
        );
      }

      const passwordHash = await hashPassword(payload.password);

      const userRows = await tx
        .insert(users)
        .values({
          id: userId,
          companyId: company.id,
          name: payload.name,
          email: payload.email,
          phone: payload.companyPhone,
          password: passwordHash,
          role: ROLES.ADMIN,
          status: "active",
          createdBy: userId
        })
        .returning({
          id: users.id,
          companyId: users.companyId,
          role: users.role,
          name: users.name,
          email: users.email,
          phone: users.phone
        });

      const created = userRows[0];
      if (!created) {
        throw new ApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          HTTP_MESSAGES.ERROR.INTERNAL_SERVER_ERROR
        );
      }

      return {
        userId: created.id,
        companyId: created.companyId,
        companyPhone: company.phone,
        messageCredits: company.messageCredits ?? 0,
        role: created.role,
        userDetails: {
          name: created.name,
          email: created.email,
          phone: created.phone ?? null
        }
      };
    });
  } catch (err) {
    return handleUniqueViolation(err);
  }
};

export const getMe = async (
  userId: string
): Promise<{
  userId: string;
  companyId: string;
  companyPhone: string;
  messageCredits: number;
  role: string;
  name: string;
  email: string;
}> => {
  const rows = await db
    .select({
      userId: users.id,
      companyId: users.companyId,
      companyPhone: companies.phone,
      messageCredits: sql<number>`COALESCE(${companies.messageCredits}, 0)`,
      role: users.role,
      name: users.name,
      email: users.email
    })
    .from(users)
    .innerJoin(companies, eq(companies.id, users.companyId))
    .where(and(eq(users.id, userId), eq(users.status, "active")))
    .limit(1);

  const user = rows[0];
  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
  }

  return user;
};
