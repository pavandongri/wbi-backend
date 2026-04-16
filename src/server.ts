import app from "./app";
import { env } from "./config/env";
import { checkDbConnection } from "./db/index";
import { logger } from "./logger/app.logger";

const startServer = async () => {
  try {
    await checkDbConnection();
    logger.info("Database connection successful");

    app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
    });
  } catch (err) {
    logger.error({
      message: "Database connection failed. Server will not start.",
      error: err instanceof Error ? err.message : String(err)
    });
    process.exit(1);
  }
};

void startServer();
