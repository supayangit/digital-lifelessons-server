import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { verifySession } from "../middlewares/verifySession.js";
import * as ReportController from "../controllers/report.controller.js";

const router = Router();

router.post("/", verifySession, asyncHandler(ReportController.createReport));

export default router;
