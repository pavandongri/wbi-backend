import { Router } from "express";

import * as templatesController from "controllers/templates.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(templatesController.createTemplate));
router.get("/", requireAuth, asyncHandler(templatesController.listTemplates));
router.get("/:id", requireAuth, asyncHandler(templatesController.getTemplateById));
router.patch("/:id", requireAuth, asyncHandler(templatesController.updateTemplate));
router.delete("/:id", requireAuth, asyncHandler(templatesController.deleteTemplate));

export default router;
