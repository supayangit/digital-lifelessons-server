import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import * as UserController from "../controllers/user.controller.js";
import * as LessonController from "../controllers/lesson.controller.js";

const router = Router();

// Profile routes
router.get("/profile", asyncHandler(UserController.getProfile));
router.get("/me", asyncHandler(UserController.getProfile));
router.patch("/profile", asyncHandler(UserController.updateProfile));
router.put("/me", asyncHandler(UserController.updateProfile));
router.get("/me/public-lessons", asyncHandler(UserController.getMyPublicLessons));

// Public user lesson listing
router.get("/:userId/public-lessons", asyncHandler(LessonController.getUserPublicLessons));
router.get("/:userId", asyncHandler(UserController.getUserById));

export default router;
