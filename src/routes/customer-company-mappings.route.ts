import { Router } from "express";

import * as mappingsController from "controllers/customer-company-mappings.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(mappingsController.createCustomerCompanyMapping));
router.get("/", requireAuth, asyncHandler(mappingsController.listCustomerCompanyMappings));
router.get("/:id", requireAuth, asyncHandler(mappingsController.getCustomerCompanyMappingById));
router.patch("/:id", requireAuth, asyncHandler(mappingsController.updateCustomerCompanyMapping));
router.delete("/:id", requireAuth, asyncHandler(mappingsController.deleteCustomerCompanyMapping));

export default router;
