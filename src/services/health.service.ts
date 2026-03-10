import { logger } from "logger/app.logger";

export const getHealth = () => {
  logger.info("inside getHealth");

  return {
    status: "healthy",
    uptime: process.uptime()
  };
};
