import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import * as DashboardController from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/overview", asyncHandler(DashboardController.getOverview));

export default router;
