import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import * as CommentController from "../controllers/comment.controller.js";

const router = Router();

router.post("/", asyncHandler(CommentController.createComment));
router.get("/:lessonId", asyncHandler(CommentController.getCommentsByLesson));
router.delete("/:id", asyncHandler(CommentController.deleteComment));

export default router;
