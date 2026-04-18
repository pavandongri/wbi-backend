export type envType = {
  PORT: string;
  NODE_ENV: string;
  DATABASE_URL: string;
  AUTH_COOKIE_SECRET: string;
  CORS_ORIGIN: string;
};

export type AuthUserDetails = {
  name: string;
  email: string;
  phone: string | null;
};

export type AuthContext = {
  userId: string;
  companyId: string;
  role: string;
  userDetails: AuthUserDetails;
};
