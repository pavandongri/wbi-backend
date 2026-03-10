export const HTTP_MESSAGES = {
  ERROR: {
    INTERNAL_SERVER_ERROR: "Internal server error",
    BAD_REQUEST: "Bad request",
    UNAUTHORIZED: "Unauthorized access",
    FORBIDDEN: "Forbidden",
    NOT_FOUND: "Resource not found",

    USER_NOT_FOUND: "User not found",
    INVALID_TOKEN: "Invalid token",
    TOKEN_EXPIRED: "Token has expired",
    INVALID_CREDENTIALS: "Invalid credentials",

    VALIDATION_FAILED: "Validation failed",
    DUPLICATE_RESOURCE: "Resource already exists",

    SERVICE_UNAVAILABLE: "Service temporarily unavailable"
  },

  SUCCESS: {
    OK: "Request successful",
    CREATED: "Resource created successfully",
    UPDATED: "Resource updated successfully",
    DELETED: "Resource deleted successfully",

    LOGIN_SUCCESS: "Login successful",
    LOGOUT_SUCCESS: "Logout successful",

    DATA_FETCHED: "Data fetched successfully"
  }
} as const;
