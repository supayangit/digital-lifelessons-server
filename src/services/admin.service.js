import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";
import { getAdminAnalytics, getReportedLessonsAggregation } from "../utils/aggregation.js";

export async function getAdminOverview() {
  return getAdminAnalytics();
}

export async function listUsers(query) {
  const db = getDB();
  const { page, limit, skip } = parsePagination(query);

  const filter = {};
  if (query.search) {
    const regex = { $regex: query.search, $options: "i" };
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [users, total] = await Promise.all([
    db
      .collection("user")
      .find(filter, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection("user").countDocuments(filter),
  ]);

  // Add lessonsCount for each user
  const usersWithCounts = await Promise.all(
    users.map(async (user) => {
      const lessonsCount = await db.collection("lessons").countDocuments({ creatorId: user._id });
      return { ...user, lessonsCount };
    })
  );

  return { users: usersWithCounts, pagination: buildPaginationMeta({ page, limit, total }) };
}

export async function updateUserRole(userId, role) {
  const db = getDB();

  if (!ObjectId.isValid(userId)) {
    const err = new Error("Invalid user ID.");
    err.statusCode = 400;
    throw err;
  }

  const validRoles = ["user", "admin"];
  if (!validRoles.includes(role)) {
    const err = new Error("Invalid role. Must be 'user' or 'admin'.");
    err.statusCode = 400;
    throw err;
  }

  const result = await db.collection("user").findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { role, updatedAt: new Date() } },
    { returnDocument: "after", projection: { password: 0 } }
  );

  if (!result) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  return result;
}

export async function updateUserSubscription(userId, isPremium) {
  const db = getDB();

  if (!ObjectId.isValid(userId)) {
    const err = new Error("Invalid user ID.");
    err.statusCode = 400;
    throw err;
  }

  const updateData = { isPremium, updatedAt: new Date() };
  if (isPremium) {
    updateData.premiumSince = new Date();
  }

  const result = await db.collection("user").findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: updateData },
    { returnDocument: "after", projection: { password: 0 } }
  );

  if (!result) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  return result;
}

export async function deleteUser(userId) {
  const db = getDB();

  if (!ObjectId.isValid(userId)) {
    const err = new Error("Invalid user ID.");
    err.statusCode = 400;
    throw err;
  }

  const result = await db.collection("user").deleteOne({ _id: new ObjectId(userId) });

  if (result.deletedCount === 0) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  return { deleted: true };
}

export async function listAdminLessons(query) {
  const db = getDB();
  const { page, limit, skip } = parsePagination(query);

  const filter = {};
  if (query.category) filter.category = query.category;
  if (query.visibility) filter.visibility = query.visibility;
  if (query.featured !== undefined) filter.featured = query.featured === "true";
  if (query.reviewed !== undefined) filter.reviewed = query.reviewed === "true";

  const [lessons, total] = await Promise.all([
    db.collection("lessons").find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection("lessons").countDocuments(filter),
  ]);

  return { lessons, pagination: buildPaginationMeta({ page, limit, total }) };
}

export async function toggleFeature(lessonId) {
  const db = getDB();

  if (!ObjectId.isValid(lessonId)) {
    const err = new Error("Invalid lesson ID.");
    err.statusCode = 400;
    throw err;
  }

  const lesson = await db.collection("lessons").findOne({ _id: new ObjectId(lessonId) });
  if (!lesson) {
    const err = new Error("Lesson not found.");
    err.statusCode = 404;
    throw err;
  }

  const result = await db.collection("lessons").findOneAndUpdate(
    { _id: new ObjectId(lessonId) },
    { $set: { featured: !lesson.featured, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  return result;
}

export async function markReviewed(lessonId) {
  const db = getDB();

  if (!ObjectId.isValid(lessonId)) {
    const err = new Error("Invalid lesson ID.");
    err.statusCode = 400;
    throw err;
  }

  const result = await db.collection("lessons").findOneAndUpdate(
    { _id: new ObjectId(lessonId) },
    { $set: { reviewed: true, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    const err = new Error("Lesson not found.");
    err.statusCode = 404;
    throw err;
  }

  return result;
}

export async function adminDeleteLesson(lessonId) {
  const db = getDB();

  if (!ObjectId.isValid(lessonId)) {
    const err = new Error("Invalid lesson ID.");
    err.statusCode = 400;
    throw err;
  }

  const oid = new ObjectId(lessonId);
  const result = await db.collection("lessons").deleteOne({ _id: oid });

  if (result.deletedCount === 0) {
    const err = new Error("Lesson not found.");
    err.statusCode = 404;
    throw err;
  }

  await Promise.all([
    db.collection("comments").deleteMany({ lessonId: oid }),
    db.collection("favorites").deleteMany({ lessonId: oid }),
    db.collection("lessonReports").deleteMany({ lessonId: oid }),
  ]);

  return { deleted: true };
}

export async function getReportedLessons(query) {
  const { page, limit, skip } = parsePagination(query);
  const data = await getReportedLessonsAggregation({ skip, limit });
  return { data };
}

export async function ignoreReports(lessonId) {
  const db = getDB();

  if (!ObjectId.isValid(lessonId)) {
    const err = new Error("Invalid lesson ID.");
    err.statusCode = 400;
    throw err;
  }

  const result = await db
    .collection("lessonReports")
    .deleteMany({ lessonId: new ObjectId(lessonId) });

  return { removed: result.deletedCount };
}

export async function deleteReportedLesson(lessonId) {
  const db = getDB();

  if (!ObjectId.isValid(lessonId)) {
    const err = new Error("Invalid lesson ID.");
    err.statusCode = 400;
    throw err;
  }

  const oid = new ObjectId(lessonId);

  await Promise.all([
    db.collection("lessons").deleteOne({ _id: oid }),
    db.collection("lessonReports").deleteMany({ lessonId: oid }),
    db.collection("comments").deleteMany({ lessonId: oid }),
    db.collection("favorites").deleteMany({ lessonId: oid }),
  ]);

  return { deleted: true };
}
