import { Router } from "express";
import { asyncHandler } from "utils/catch-async";
import * as healthController from "../controllers/health.controller";

const router = Router();

router.get("/", asyncHandler(healthController.getHealth));

export default router;
