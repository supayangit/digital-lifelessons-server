import { Router } from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { verifySession } from "../middlewares/verifySession.js";
import * as FavoriteController from "../controllers/favorite.controller.js";

const router = Router();

// All favorites routes require authentication
router.use(verifySession);

router.post("/", asyncHandler(FavoriteController.saveFavorite));
router.delete("/:lessonId", asyncHandler(FavoriteController.removeFavorite));
router.get("/my-favorites", asyncHandler(FavoriteController.getMyFavorites));

export default router;
