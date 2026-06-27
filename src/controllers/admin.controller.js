import * as AdminService from "../services/admin.service.js";

export async function getOverview(req, res) {
  const data = await AdminService.getAdminOverview();
  res.json({ success: true, ...data });
}

export async function listUsers(req, res) {
  const result = await AdminService.listUsers(req.query);
  res.json({ success: true, ...result });
}

export async function updateUserRole(req, res) {
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ success: false, message: "role is required." });
  }
  const user = await AdminService.updateUserRole(req.params.id, role);
  res.json({ success: true, user });
}

export async function updateUserSubscription(req, res) {
  const { isPremium } = req.body;
  if (isPremium === undefined) {
    return res.status(400).json({ success: false, message: "isPremium is required." });
  }
  const user = await AdminService.updateUserSubscription(req.params.id, isPremium);
  res.json({ success: true, user });
}

export async function deleteUser(req, res) {
  await AdminService.deleteUser(req.params.id);
  res.json({ success: true, message: "User deleted." });
}

export async function listLessons(req, res) {
  const result = await AdminService.listAdminLessons(req.query);
  res.json({ success: true, ...result });
}

export async function toggleFeature(req, res) {
  const lesson = await AdminService.toggleFeature(req.params.id);
  res.json({ success: true, lesson });
}

export async function markReviewed(req, res) {
  const lesson = await AdminService.markReviewed(req.params.id);
  res.json({ success: true, lesson });
}

export async function deleteLesson(req, res) {
  await AdminService.adminDeleteLesson(req.params.id);
  res.json({ success: true, message: "Lesson deleted." });
}

export async function getReportedLessons(req, res) {
  const result = await AdminService.getReportedLessons(req.query);
  res.json({ success: true, ...result });
}

export async function ignoreReports(req, res) {
  const result = await AdminService.ignoreReports(req.params.lessonId);
  res.json({ success: true, ...result });
}

export async function deleteReportedLesson(req, res) {
  await AdminService.deleteReportedLesson(req.params.lessonId);
  res.json({ success: true, message: "Lesson and all reports deleted." });
}
