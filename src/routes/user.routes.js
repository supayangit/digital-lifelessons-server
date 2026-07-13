import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { verifySession } from "../middlewares/verifySession.js";
import * as UserController from "../controllers/user.controller.js";
import * as LessonController from "../controllers/lesson.controller.js";

const router = Router();

// Protected profile routes
router.get("/profile", verifySession, asyncHandler(UserController.getProfile));
router.get("/me", verifySession, asyncHandler(UserController.getProfile));
router.patch("/profile", verifySession, asyncHandler(UserController.updateProfile));
// Backwards-compatible route used by client: PUT /api/users/me
router.put("/me", verifySession, asyncHandler(UserController.updateProfile));
router.get("/me/public-lessons", verifySession, asyncHandler(UserController.getMyPublicLessons));

// Public user lesson listing
router.get("/:userId/public-lessons", asyncHandler(LessonController.getUserPublicLessons));
router.get("/:userId", asyncHandler(UserController.getUserById));

export default router;
