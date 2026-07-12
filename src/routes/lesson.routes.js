import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import * as LessonController from "../controllers/lesson.controller.js";

const router = Router();

// ── All routes  ───────────────────────────────────────────────────────────────
router.get("/", asyncHandler(LessonController.getPublicLessons));
router.get("/featured", asyncHandler(LessonController.getFeaturedLessons));
router.get("/top-contributors", asyncHandler(LessonController.getTopContributors));
router.get("/most-saved", asyncHandler(LessonController.getMostSavedLessons));
router.get("/:userId/public-lessons", asyncHandler(LessonController.getUserPublicLessons));
router.get("/my-lessons", asyncHandler(LessonController.getMyLessons));
router.get("/:id", asyncHandler(LessonController.getLessonById));

router.post("/", asyncHandler(LessonController.createLesson));
router.put("/:id", asyncHandler(LessonController.updateLesson));
router.delete("/:id", asyncHandler(LessonController.deleteLesson));
router.patch("/:id/visibility", asyncHandler(LessonController.toggleVisibility));
router.patch("/:id/access-level", asyncHandler(LessonController.changeAccessLevel));
router.patch("/:id/like", asyncHandler(LessonController.toggleLike));

export default router;

