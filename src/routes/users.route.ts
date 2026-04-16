import { Router } from "express";

import * as usersController from "controllers/users.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(usersController.createUser));
router.get("/", requireAuth, asyncHandler(usersController.listUsers));
router.get("/:id", requireAuth, asyncHandler(usersController.getUserById));
router.patch("/:id", requireAuth, asyncHandler(usersController.updateUser));
router.delete("/:id", requireAuth, asyncHandler(usersController.deleteUser));

export default router;
