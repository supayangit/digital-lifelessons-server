import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import * as ReportController from "../controllers/report.controller.js";

const router = Router();

router.post("/", asyncHandler(ReportController.createReport));

export default router;
