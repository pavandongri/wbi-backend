import dotenv from "dotenv";
import path from "path";
import { envType } from "../types/common.types";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  quiet: true
});

export const env: envType = {
  PORT: process.env.PORT ?? "",
  NODE_ENV: process.env.NODE_ENV ?? "",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET ?? "",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ?? "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ?? "",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ?? "",
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ?? "",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
  WEBHOOK_CALLBACK_URL: process.env.WEBHOOK_CALLBACK_URL ?? "",
  GRAPH_API_BASE: process.env.GRAPH_API_BASE ?? ""
};
