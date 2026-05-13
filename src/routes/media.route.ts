import { Router } from "express";

import * as mediaController from "controllers/media.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/presign", requireAuth, asyncHandler(mediaController.presignUpload));
router.post("/meta-upload", requireAuth, asyncHandler(mediaController.metaUpload));

export default router;
