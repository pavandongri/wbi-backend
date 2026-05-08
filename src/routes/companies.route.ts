import { Router } from "express";

import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";
import * as companiesController from "../controllers/companies.controller";
import * as webhookController from "../controllers/webhook.controller";

const router = Router();

router.post("/", requireAuth, asyncHandler(companiesController.createCompany));
router.get("/", requireAuth, asyncHandler(companiesController.listCompanies));
router.get("/:id", requireAuth, asyncHandler(companiesController.getCompanyById));
router.patch("/:id", requireAuth, asyncHandler(companiesController.updateCompany));
router.delete("/:id", requireAuth, asyncHandler(companiesController.deleteCompany));

// WhatsApp embedded Facebook login
router.post("/facebook/exchange-code", requireAuth, asyncHandler(webhookController.exchangeCode));
router.post(
  "/facebook/subscribe-to-waba",
  requireAuth,
  asyncHandler(webhookController.subscribeToWABA)
);

export default router;
