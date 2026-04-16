import { Router } from "express";

import * as groupsController from "controllers/groups.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(groupsController.createGroup));
router.get("/", requireAuth, asyncHandler(groupsController.listGroups));
router.get("/:id", requireAuth, asyncHandler(groupsController.getGroupById));
router.patch("/:id", requireAuth, asyncHandler(groupsController.updateGroup));
router.delete("/:id", requireAuth, asyncHandler(groupsController.deleteGroup));

export default router;
