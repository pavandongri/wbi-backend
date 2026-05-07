import { Router } from "express";

import * as paymentsController from "controllers/payments.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

// Razorpay webhook — no auth, must be registered before requireAuth routes
router.post("/webhook", asyncHandler(paymentsController.handleWebhook));

router.post("/orders", requireAuth, asyncHandler(paymentsController.createOrder));
router.post("/verify", requireAuth, asyncHandler(paymentsController.verifyPayment));
router.get("/", requireAuth, asyncHandler(paymentsController.listPayments));
router.get("/:id", requireAuth, asyncHandler(paymentsController.getPaymentById));
router.patch("/:id", requireAuth, asyncHandler(paymentsController.updatePayment));
router.post("/:id/refund", requireAuth, asyncHandler(paymentsController.refundPayment));

export default router;
