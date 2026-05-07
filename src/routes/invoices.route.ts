import { Router } from "express";

import * as invoicesController from "controllers/invoices.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(invoicesController.createInvoice));
router.get("/", requireAuth, asyncHandler(invoicesController.listInvoices));
router.get("/:id", requireAuth, asyncHandler(invoicesController.getInvoiceById));
router.patch("/:id", requireAuth, asyncHandler(invoicesController.updateInvoice));

export default router;
