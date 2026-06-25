import * as LessonService from "../services/lesson.service.js";
import * as LikeService from "../services/like.service.js";
import {
  createLessonSchema,
  updateLessonSchema,
  visibilitySchema,
  accessLevelSchema,
} from "../validations/lesson.validation.js";
import { calculateReadingTime } from "../utils/readingTime.js";



export async function getPublicLessons(req, res) {
  const result = await LessonService.listPublicLessons(req.query);
  res.json({ success: true, ...result });
}

export async function getFeaturedLessons(req, res) {
  const lessons = await LessonService.getFeaturedLessons();
  res.json({ success: true, lessons });
}

export async function getTopContributors(req, res) {
  const contributors = await LessonService.getTopContributorsService();
  res.json({ success: true, contributors });
}

export async function getMostSavedLessons(req, res) {
  const result = await LessonService.getMostSavedLessonsService(req.query);
  res.json({ success: true, ...result });
}

export async function getLessonById(req, res) {
  const result = await LessonService.getLessonById(req.params.id, req.user || null);
  if (result.locked) {
    return res.status(403).json({
      success: false,
      locked: true,
      message: "This is a premium lesson. Upgrade to access the full content.",
      lesson: result.lesson,
    });
  }
  res.json({ success: true, lesson: result.lesson });
}

export async function createLesson(req, res) {
  const data = createLessonSchema.parse(req.body);
  data.readingTime = calculateReadingTime(data.description);
  const lesson = await LessonService.createLesson(data, req.user);
  res.status(201).json({ success: true, lesson });
}

export async function updateLesson(req, res) {
  const data = updateLessonSchema.parse(req.body);
  if (data.description) {
    data.readingTime = calculateReadingTime(data.description);
  }
  const lesson = await LessonService.updateLesson(req.params.id, data);
  res.json({ success: true, lesson });
}

export async function deleteLesson(req, res) {
  await LessonService.deleteLesson(req.params.id);
  res.json({ success: true, message: "Lesson deleted successfully." });
}

export async function toggleVisibility(req, res) {
  const lesson = await LessonService.toggleVisibility(req.params.id);
  res.json({ success: true, lesson });
}

export async function changeAccessLevel(req, res) {
  const { accessLevel } = accessLevelSchema.parse(req.body);
  const lesson = await LessonService.changeAccessLevel(req.params.id, accessLevel);
  res.json({ success: true, lesson });
}

export async function toggleLike(req, res) {
  const result = await LikeService.toggleLike(req.params.id, req.user.id);
  res.json({ success: true, liked: result.liked, lesson: result.lesson });
}

export async function getUserPublicLessons(req, res) {
  const result = await LessonService.getUserPublicLessons(req.params.userId, req.query);
  res.json({ success: true, ...result });
}

export async function getMyLessons(req, res) {
  const result = await LessonService.getMyLessons(req.user.id, req.query);
  res.json({ success: true, ...result });
}
