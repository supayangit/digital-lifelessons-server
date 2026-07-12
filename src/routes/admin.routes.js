import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import * as AdminController from "../controllers/admin.controller.js";

const router = Router();

// Overview / Analytics
router.get("/overview", asyncHandler(AdminController.getOverview));

// Users
router.get("/users", asyncHandler(AdminController.listUsers));
router.patch("/users/:id/role", asyncHandler(AdminController.updateUserRole));
router.patch("/users/:id/subscription", asyncHandler(AdminController.updateUserSubscription));
router.delete("/users/:id", asyncHandler(AdminController.deleteUser));

// Lessons
router.get("/lessons", asyncHandler(AdminController.listLessons));
router.patch("/lessons/:id/feature", asyncHandler(AdminController.toggleFeature));
router.patch("/lessons/:id/review", asyncHandler(AdminController.markReviewed));
router.delete("/lessons/:id", asyncHandler(AdminController.deleteLesson));

// Reports
router.get("/reported-lessons", asyncHandler(AdminController.getReportedLessons));
router.patch("/reported-lessons/:lessonId/ignore", asyncHandler(AdminController.ignoreReports));
router.delete("/reported-lessons/:lessonId", asyncHandler(AdminController.deleteReportedLesson));

export default router;
