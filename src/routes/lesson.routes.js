import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { verifySession } from "../middlewares/verifySession.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { verifyLessonOwner } from "../middlewares/verifyLessonOwner.js";
import { verifyPremium } from "../middlewares/verifyPremium.js";
import * as LessonController from "../controllers/lesson.controller.js";

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.get("/", asyncHandler(LessonController.getPublicLessons));
router.get("/featured", asyncHandler(LessonController.getFeaturedLessons));
router.get("/top-contributors", asyncHandler(LessonController.getTopContributors));
router.get("/most-saved", asyncHandler(LessonController.getMostSavedLessons));

// Public user lessons
router.get("/:userId/public-lessons", asyncHandler(LessonController.getUserPublicLessons));

// Protected routes that must come before dynamic :id route
router.get("/my-lessons", verifySession, asyncHandler(LessonController.getMyLessons));

// Single lesson (handles premium lock inline) - optional auth for isFavorited flag
router.get("/:id", asyncHandler(optionalAuth), asyncHandler(LessonController.getLessonById));

// ── Protected routes ──────────────────────────────────────────────────────────
router.post("/", verifySession, asyncHandler(LessonController.createLesson));

router.put(
  "/:id",
  verifySession,
  asyncHandler(verifyLessonOwner),
  asyncHandler(LessonController.updateLesson)
);

router.delete(
  "/:id",
  verifySession,
  asyncHandler(verifyLessonOwner),
  asyncHandler(LessonController.deleteLesson)
);

router.patch(
  "/:id/visibility",
  verifySession,
  asyncHandler(verifyLessonOwner),
  asyncHandler(LessonController.toggleVisibility)
);

router.patch(
  "/:id/access-level",
  verifySession,
  verifyPremium,
  asyncHandler(verifyLessonOwner),
  asyncHandler(LessonController.changeAccessLevel)
);

router.patch("/:id/like", verifySession, asyncHandler(LessonController.toggleLike));

export default router;

