import { Router } from "express";
import healthRoute from "./health.route";
import authRoute from "./auth.route";
import companiesRoute from "./companies.route";
import usersRoute from "./users.route";
import groupsRoute from "./groups.route";
import customersRoute from "./customers.route";
import customerCompanyMappingsRoute from "./customer-company-mappings.route";
import customerGroupMappingsRoute from "./customer-group-mappings.route";

const router = Router();

router.use("/health", healthRoute);
router.use("/auth", authRoute);
router.use("/companies", companiesRoute);
router.use("/users", usersRoute);
router.use("/groups", groupsRoute);
router.use("/customers", customersRoute);
router.use("/customer-company-mappings", customerCompanyMappingsRoute);
router.use("/customer-group-mappings", customerGroupMappingsRoute);

export default router;
