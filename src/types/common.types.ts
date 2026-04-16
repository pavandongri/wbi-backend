export type envType = {
  PORT: string;
  NODE_ENV: string;
  DATABASE_URL: string;
  AUTH_COOKIE_SECRET: string;
  CORS_ORIGIN: string;
};

export type AuthContext = { userId: string; companyId: string; role: string };
