import { Router } from "express";

import { asyncHandler } from "utils/catch-async";
import { requireAuth } from "middleware/auth.middleware";
import * as authController from "../controllers/auth.controller";

const router = Router();

router.post("/signup", asyncHandler(authController.signup));
router.post("/login", asyncHandler(authController.login));
router.post("/logout", requireAuth, asyncHandler(authController.logout));
router.get("/me", requireAuth, asyncHandler(authController.me));

export default router;
