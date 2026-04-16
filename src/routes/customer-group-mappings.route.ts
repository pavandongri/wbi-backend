import { Router } from "express";

import * as mappingsController from "controllers/customer-group-mappings.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(mappingsController.createCustomerGroupMapping));
router.get("/", requireAuth, asyncHandler(mappingsController.listCustomerGroupMappings));
router.get("/:id", requireAuth, asyncHandler(mappingsController.getCustomerGroupMappingById));
router.patch("/:id", requireAuth, asyncHandler(mappingsController.updateCustomerGroupMapping));
router.delete("/:id", requireAuth, asyncHandler(mappingsController.deleteCustomerGroupMapping));

export default router;
