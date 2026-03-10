import app from "./app";
import { env } from "./config/env";
import { logger } from "./logger/app.logger";

app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
});
