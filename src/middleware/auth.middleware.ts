import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies, users } from "db/schema";
import { ApiError } from "utils/api-error.utils";
import { getAuthTokenFromRequest, verifyAuthCookie } from "utils/cookie.utils";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.UNAUTHORIZED);
  }

  const cookiePayload = verifyAuthCookie(token);

  // Verify user + company are both active (prevents using stale cookies after soft-delete).
  const [userRows, companyRows] = await Promise.all([
    db
      .select({
        id: users.id,
        companyId: users.companyId,
        role: users.role,
        name: users.name,
        email: users.email,
        phone: users.phone
      })
      .from(users)
      .where(and(eq(users.id, cookiePayload.userId), eq(users.status, "active")))
      .limit(1),
    db
      .select({
        id: companies.id
      })
      .from(companies)
      .where(and(eq(companies.id, cookiePayload.companyId), eq(companies.status, "active")))
      .limit(1)
  ]);

  const user = userRows[0];
  const company = companyRows[0];

  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, HTTP_MESSAGES.ERROR.INVALID_TOKEN);
  }
  if (!company || user.companyId !== company.id) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, HTTP_MESSAGES.ERROR.FORBIDDEN);
  }

  req.auth = {
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    userDetails: {
      name: user.name,
      email: user.email,
      phone: user.phone ?? null
    }
  };

  next();
};
