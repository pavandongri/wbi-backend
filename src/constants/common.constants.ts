export const CONSTANTS = {
  API_REQUEST_ID: "x-request-id",
  PRODUCTION: "production",
  DEVELOPMENT: "development",
  AUTH_COOKIE_NAME: "wbi_session",
  AUTH_COOKIE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  SALT_ROUNDS: 10
} as const;

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  STAFF: "staff"
} as const;

export const STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
  DELETED: "deleted",
  INPROGRESS: "in-progress"
};
