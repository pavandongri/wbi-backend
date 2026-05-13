import { Router } from "express";

import * as customersController from "controllers/customers.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(customersController.createCustomer));
router.post("/:companyId", asyncHandler(customersController.createCustomerExternal));
router.get("/", requireAuth, asyncHandler(customersController.listCustomers));
router.get("/:id", requireAuth, asyncHandler(customersController.getCustomerById));
router.patch("/:id", requireAuth, asyncHandler(customersController.updateCustomer));
router.delete("/:id", requireAuth, asyncHandler(customersController.deleteCustomer));

export default router;
