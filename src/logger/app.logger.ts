import { CONSTANTS } from "constants/common.constants";
import fs from "fs";
import path from "path";
import winston from "winston";

const logDir = path.join(process.cwd(), "logs/api-logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const today = new Date().toISOString().split("T")[0];

const isDev = process.env.NODE_ENV !== CONSTANTS.PRODUCTION;

const baseFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;

    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    const stackTrace = typeof stack === "string" ? `\nSTACK:\n${stack}` : "";

    return `${level}: ${message}${metaString}${stackTrace} timestamp=${timestamp} `;
  })
);

const consoleFormat = winston.format.combine(winston.format.colorize(), baseFormat);

const fileFormat = baseFormat;

export const logger = winston.createLogger({
  level: isDev ? "debug" : "info",
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),

    new winston.transports.File({
      filename: path.join(logDir, `${today}.api-logs.log`),
      format: fileFormat
    })
  ]
});
