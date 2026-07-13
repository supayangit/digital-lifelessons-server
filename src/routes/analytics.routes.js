import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { verifySession } from "../middlewares/verifySession.js";
import * as DashboardController from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/overview", verifySession, asyncHandler(DashboardController.getOverview));

export default router;
