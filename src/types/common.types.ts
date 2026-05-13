export type envType = {
  PORT: string;
  NODE_ENV: string;
  DATABASE_URL: string;
  AUTH_COOKIE_SECRET: string;
  CORS_ORIGIN: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  FACEBOOK_APP_ID: string;
  FACEBOOK_APP_SECRET: string;
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: string;
  WEBHOOK_CALLBACK_URL: string;
  GRAPH_API_BASE: string;
  MARKETING_MESSAGE_COST: string;
  UTILITY_MESSAGE_COST: string;
  AUTHENTICATION_MESSAGE_COST: string;
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  S3_BUCKET_NAME: string;
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
