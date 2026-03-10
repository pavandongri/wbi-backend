import fs from "fs";
import path from "path";
import winston from "winston";

const logDir = path.join(process.cwd(), "logs/request-logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const date = new Date().toISOString().split("T")[0];

type RequestLog = {
  method?: string;
  url?: string;
  requestId?: string;
  status?: number;
  duration?: string;
  message?: string;
  stack?: string;
};

const requestFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf((info) => {
    const timestamp = info.timestamp as string;
    const level = String(info.level).toUpperCase();

    const payload =
      typeof info.message === "object"
        ? (info.message as RequestLog)
        : (info as unknown as RequestLog);

    const { method, url, requestId, status, duration, message, stack } = payload;

    return `${level} ${method ?? "-"} ${url ?? "-"} status=${status ?? "-"} duration=${duration ?? "-"} requestId=${requestId ?? "-"} message=${message ?? "-"}${
      stack ? `\nSTACK:\n${stack}` : ""
    } timestamp=${timestamp} `;
  })
);

export const requestLogger = winston.createLogger({
  level: "info",
  format: requestFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, `${date}.request-logs.log`)
    })
  ]
});
