import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";
import { getMostSavedLessons, getTopContributors } from "../utils/aggregation.js";
import { ACCESS_LEVELS, VISIBILITY } from "../constants/index.js";



/**
 * Build a MongoDB filter from query params for the public lessons endpoint.
 */
function buildLessonFilter(query) {
  const filter = { visibility: VISIBILITY.PUBLIC };

  if (query.search) {
    filter.$text = { $search: query.search };
  }

  if (query.category) {
    filter.category = query.category;
  }

  if (query.tone) {
    filter.tone = query.tone;
  }

  return filter;
}

export async function listPublicLessons(query) {
  const db = getDB();
  const { page, limit, skip } = parsePagination(query);
  const filter = buildLessonFilter(query);

  // Sort options
  let sort = { createdAt: -1 };
  if (query.sort === "most-saved") {
    sort = { favoritesCount: -1, createdAt: -1 };
  }

  const [lessons, total] = await Promise.all([
    db.collection("lessons").find(filter).sort(sort).skip(skip).limit(limit).toArray(),
    db.collection("lessons").countDocuments(filter),
  ]);

  return { lessons, pagination: buildPaginationMeta({ page, limit, total }) };
}

export async function getFeaturedLessons() {
  const db = getDB();
  return db
    .collection("lessons")
    .find({ featured: true, visibility: VISIBILITY.PUBLIC })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
}

export async function getTopContributorsService() {
  return getTopContributors({ limit: 10 });
}

export async function getMostSavedLessonsService(query) {
  const { limit, skip } = parsePagination(query);
  const lessons = await getMostSavedLessons({ limit, skip });
  const db = getDB();
  const total = await db
    .collection("lessons")
    .countDocuments({ visibility: VISIBILITY.PUBLIC });
  const { page } = parsePagination(query);
  return { lessons, pagination: buildPaginationMeta({ page, limit, total }) };
}

export async function getLessonById(lessonId, user) {
  const db = getDB();

  if (!ObjectId.isValid(lessonId)) {
    const err = new Error("Invalid lesson ID.");
    err.statusCode = 400;
    throw err;
  }

  const lesson = await db
    .collection("lessons")
    .findOne({ _id: new ObjectId(lessonId) });

  if (!lesson) {
    const err = new Error("Lesson not found.");
    err.statusCode = 404;
    throw err;
  }

  // Private lesson: only owner or admin can view
  if (lesson.visibility === VISIBILITY.PRIVATE) {
    if (!user) {
      const err = new Error("This lesson is private.");
      err.statusCode = 403;
      throw err;
    }
    const isOwner = lesson.creatorId.toString() === user.id;
    if (!isOwner && user.role !== "admin") {
      const err = new Error("This lesson is private.");
      err.statusCode = 403;
      throw err;
    }
  }

  // Premium lesson: creator, premium users, and admins can view — free users get a locked response
  if (lesson.accessLevel === ACCESS_LEVELS.PREMIUM) {
    if (!user) {
      const sanitized = sanitizePremiumLesson(lesson);
      sanitized.isFavorited = false;
      sanitized.isLiked = false;
      return { locked: true, lesson: sanitized };
    }
    const isOwner = lesson.creatorId.toString() === user.id;
    const canAccess = isOwner || user.isPremium || user.role === "admin";
    if (!canAccess) {
      const [fav, like] = await Promise.all([
        db.collection("favorites").findOne({ userId: new ObjectId(user.id), lessonId: lesson._id }),
        db.collection("likes").findOne({ userId: new ObjectId(user.id), lessonId: lesson._id }),
      ]);
      const sanitized = sanitizePremiumLesson(lesson);
      sanitized.isFavorited = !!fav;
      sanitized.isLiked = !!like;
      return { locked: true, lesson: sanitized };
    }
  }

  // Increment view count (fire and forget)
  db.collection("lessons")
    .updateOne({ _id: lesson._id }, { $inc: { viewsCount: 1 } })
    .catch(() => {});

  if (user) {
    const [fav, like] = await Promise.all([
      db.collection("favorites").findOne({ userId: new ObjectId(user.id), lessonId: lesson._id }),
      db.collection("likes").findOne({ userId: new ObjectId(user.id), lessonId: lesson._id }),
    ]);
    lesson.isFavorited = !!fav;
    lesson.isLiked = !!like;
  } else {
    lesson.isFavorited = false;
    lesson.isLiked = false;
  }

  return { locked: false, lesson };
}

function sanitizePremiumLesson(lesson) {
  const { description, ...rest } = lesson;
  return { ...rest, description: null, locked: true };
}

export async function createLesson(data, user) {
  const db = getDB();

  // Free users cannot create premium lessons
  if (!user.isPremium && user.role !== "admin") {
    data.accessLevel = ACCESS_LEVELS.FREE;
  }

  const now = new Date();
  const doc = {
    ...data,
    creatorId: new ObjectId(user.id),
    creatorName: user.name,
    creatorEmail: user.email,
    creatorPhoto: user.image || null,
    likesCount: 0,
    favoritesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    featured: false,
    reviewed: false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("lessons").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function updateLesson(lessonId, data) {
  const db = getDB();

  const result = await db.collection("lessons").findOneAndUpdate(
    { _id: new ObjectId(lessonId) },
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    const err = new Error("Lesson not found.");
    err.statusCode = 404;
    throw err;
  }

  return result;
}

export async function deleteLesson(lessonId) {
  const db = getDB();
  const result = await db.collection("lessons").deleteOne({ _id: new ObjectId(lessonId) });

  if (result.deletedCount === 0) {
    const err = new Error("Lesson not found.");
    err.statusCode = 404;
    throw err;
  }

  // Cascade delete comments, favorites, likes, reports
  await Promise.all([
    db.collection("comments").deleteMany({ lessonId: new ObjectId(lessonId) }),
    db.collection("favorites").deleteMany({ lessonId: new ObjectId(lessonId) }),
    db.collection("likes").deleteMany({ lessonId: new ObjectId(lessonId) }),
    db.collection("lessonReports").deleteMany({ lessonId: new ObjectId(lessonId) }),
  ]);

  return { deleted: true };
}

export async function toggleVisibility(lessonId) {
  const db = getDB();
  const lesson = await db.collection("lessons").findOne({ _id: new ObjectId(lessonId) });
  if (!lesson) {
    const err = new Error("Lesson not found.");
    err.statusCode = 404;
    throw err;
  }

  const nextVisibility = lesson.visibility === VISIBILITY.PRIVATE ? VISIBILITY.PUBLIC : VISIBILITY.PRIVATE;
  const result = await db.collection("lessons").findOneAndUpdate(
    { _id: lesson._id },
    { $set: { visibility: nextVisibility, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    const err = new Error("Failed to toggle lesson visibility.");
    err.statusCode = 500;
    throw err;
  }

  return result;
}

export async function changeAccessLevel(lessonId, accessLevel) {
  const db = getDB();
  const result = await db.collection("lessons").findOneAndUpdate(
    { _id: new ObjectId(lessonId) },
    { $set: { accessLevel, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) {
    const err = new Error("Lesson not found.");
    err.statusCode = 404;
    throw err;
  }
  return result;
}

export async function getUserPublicLessons(userId, query) {
  const db = getDB();
  const { page, limit, skip } = parsePagination(query);

  if (!ObjectId.isValid(userId)) {
    const err = new Error("Invalid user ID.");
    err.statusCode = 400;
    throw err;
  }

  const filter = {
    creatorId: new ObjectId(userId),
    visibility: VISIBILITY.PUBLIC,
  };

  const [lessons, total] = await Promise.all([
    db.collection("lessons").find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection("lessons").countDocuments(filter),
  ]);

  return { lessons, pagination: buildPaginationMeta({ page, limit, total }) };
}

export async function getMyLessons(userId, query) {
  const db = getDB();
  const { page, limit, skip } = parsePagination(query);

  if (!ObjectId.isValid(userId)) {
    const err = new Error("Invalid user ID.");
    err.statusCode = 400;
    throw err;
  }

  // Fetch all lessons (public and private) created by the user
  const filter = {
    creatorId: new ObjectId(userId),
  };

  const [lessons, total] = await Promise.all([
    db.collection("lessons").find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection("lessons").countDocuments(filter),
  ]);

  return { lessons, pagination: buildPaginationMeta({ page, limit, total }) };
}
