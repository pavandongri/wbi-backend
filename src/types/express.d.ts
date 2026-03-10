import "express";

declare module "express-serve-static-core" {
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
