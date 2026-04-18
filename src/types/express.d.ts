import "express";

declare module "express-serve-static-core" {
  interface AuthContext {
    userId: string;
    companyId: string;
    role: string;
    userDetails: {
      name: string;
      email: string;
      phone: string | null;
    };
  }

  interface Request {
    auth?: AuthContext;
  }

  interface Response {
    successResponse: (options?: {
      data?: unknown;
      message?: string;
      statusCode?: number;
    }) => Response;

    errorResponse: (options?: {
      message?: string;
      statusCode?: number;
      errorCode?: string;
    }) => Response;
  }
}
