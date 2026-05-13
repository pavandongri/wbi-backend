import { Router } from "express";
import healthRoute from "./health.route";
import authRoute from "./auth.route";
import companiesRoute from "./companies.route";
import usersRoute from "./users.route";
import groupsRoute from "./groups.route";
import customersRoute from "./customers.route";
import customerCompanyMappingsRoute from "./customer-company-mappings.route";
import customerGroupMappingsRoute from "./customer-group-mappings.route";
import templatesRoute from "./templates.route";
import messagesRoute from "./messages.route";
import subscriptionPlansRoute from "./subscription-plans.route";
import subscriptionsRoute from "./subscriptions.route";
import paymentsRoute from "./payments.route";
import invoicesRoute from "./invoices.route";
import mediaRoute from "./media.route";
import webhooksRoute from "./webhooks.route";

const router = Router();

router.use("/health", healthRoute);
router.use("/auth", authRoute);
router.use("/companies", companiesRoute);
router.use("/users", usersRoute);
router.use("/groups", groupsRoute);
router.use("/customers", customersRoute);
router.use("/customer-company-mappings", customerCompanyMappingsRoute);
router.use("/customer-group-mappings", customerGroupMappingsRoute);
router.use("/templates", templatesRoute);
router.use("/messages", messagesRoute);
router.use("/subscription-plans", subscriptionPlansRoute);
router.use("/subscriptions", subscriptionsRoute);
router.use("/payments", paymentsRoute);
router.use("/invoices", invoicesRoute);
router.use("/media", mediaRoute);
router.use("/webhooks", webhooksRoute);

export default router;
