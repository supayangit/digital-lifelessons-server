import * as LessonService from "../services/lesson.service.js";
import * as UserService from "../services/user.service.js";
import { updateProfileSchema } from "../validations/user.validation.js";

export async function getProfile(req, res) {
  const result = await UserService.getUserProfile(req.user.id);
  res.json({ success: true, ...result });
}

export async function getUserById(req, res) {
  const result = await UserService.getUserById(req.params.userId);
  res.json({ success: true, ...result });
}

export async function getMyPublicLessons(req, res) {
  const result = await LessonService.getUserPublicLessons(req.user.id, req.query);
  res.json({ success: true, ...result });
}

export async function updateProfile(req, res) {
  const data = updateProfileSchema.parse(req.body);
  const user = await UserService.updateUserProfile(req.user.id, data);
  res.json({ success: true, message: "Profile updated successfully.", user });
}
