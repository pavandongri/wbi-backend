import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "config/env";
import { errorHandler } from "./middleware/error-handler.middleware";
import { requestIdMiddleware } from "./middleware/request-id.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";
import routes from "./routes/index.route";

const app = express();

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const allowed = env?.CORS_ORIGIN?.split(",") ?? [];
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    }
  })
);

app.use(helmet());
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

app.use("/api/v1", routes);

app.use(errorHandler);

export default app;
