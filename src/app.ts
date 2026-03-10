import cors from "cors";
import express from "express";
import helmet from "helmet";

import { errorHandler } from "./middleware/error-handler.middleware";
import { requestIdMiddleware } from "./middleware/request-id.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";
import routes from "./routes/index.route";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

app.use("/api/v1", routes);

app.use(errorHandler);

export default app;
