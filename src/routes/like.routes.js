import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import * as LikeController from "../controllers/like.controller.js";

const router = Router();

router.post("/", asyncHandler(LikeController.saveLike));
router.delete("/:lessonId", asyncHandler(LikeController.removeLike));
router.get("/my-likes", asyncHandler(LikeController.getMyLikes));

export default router;
