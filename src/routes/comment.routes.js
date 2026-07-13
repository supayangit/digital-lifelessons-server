import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { verifySession } from "../middlewares/verifySession.js";
import * as CommentController from "../controllers/comment.controller.js";

const router = Router();

router.post("/", verifySession, asyncHandler(CommentController.createComment));
router.get("/:lessonId", asyncHandler(CommentController.getCommentsByLesson));
router.delete("/:id", verifySession, asyncHandler(CommentController.deleteComment));

export default router;
