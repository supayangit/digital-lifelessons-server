import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";

export async function saveFavorite(lessonId, userId) {
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

  const lessonOid = new ObjectId(lessonId);
  const userOid = new ObjectId(userId);
  const now = new Date();

  // Check for duplicate
  const existing = await db.collection("favorites").findOne({
    userId: userOid,
    lessonId: lessonOid,
  });

  if (existing) {
    const err = new Error("Lesson is already in your favorites.");
    err.statusCode = 409;
    throw err;
  }

  await db.collection("favorites").insertOne({
    userId: userOid,
    lessonId: lessonOid,
    createdAt: now,
  });

  // Increment lesson favoritesCount
  await db
    .collection("lessons")
    .updateOne({ _id: lessonOid }, { $inc: { favoritesCount: 1 } });

  return { saved: true };
}

export async function removeFavorite(lessonId, userId) {
  const db = getDB();

  if (!ObjectId.isValid(lessonId)) {
    const err = new Error("Invalid lesson ID.");
    err.statusCode = 400;
    throw err;
  }

  const result = await db.collection("favorites").deleteOne({
    userId: new ObjectId(userId),
    lessonId: new ObjectId(lessonId),
  });

  if (result.deletedCount === 0) {
    const err = new Error("Favorite not found.");
    err.statusCode = 404;
    throw err;
  }

  // Decrement lesson favoritesCount
  await db
    .collection("lessons")
    .updateOne(
      { _id: new ObjectId(lessonId) },
      { $inc: { favoritesCount: -1 } }
    );

  return { removed: true };
}

export async function getMyFavorites(userId, query) {
  const db = getDB();
  const { page, limit, skip } = parsePagination(query);
  const userOid = new ObjectId(userId);

  // Build lesson filter to apply on joined lessons
  const lessonMatch = {};
  if (query.category) lessonMatch["lesson.category"] = query.category;
  if (query.tone) lessonMatch["lesson.tone"] = query.tone;

  const pipeline = [
    { $match: { userId: userOid } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "lessons",
        localField: "lessonId",
        foreignField: "_id",
        as: "lesson",
      },
    },
    { $unwind: "$lesson" },
    ...(Object.keys(lessonMatch).length > 0 ? [{ $match: lessonMatch }] : []),
    { $skip: skip },
    { $limit: limit },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: ["$lesson", { savedAt: "$createdAt" }],
        },
      },
    },
  ];

  const countPipeline = [
    { $match: { userId: userOid } },
    {
      $lookup: {
        from: "lessons",
        localField: "lessonId",
        foreignField: "_id",
        as: "lesson",
      },
    },
    { $unwind: "$lesson" },
    ...(Object.keys(lessonMatch).length > 0 ? [{ $match: lessonMatch }] : []),
    { $count: "total" },
  ];

  const [favorites, countResult] = await Promise.all([
    db.collection("favorites").aggregate(pipeline).toArray(),
    db.collection("favorites").aggregate(countPipeline).toArray(),
  ]);

  const total = countResult[0]?.total || 0;

  // Return the joined lesson documents as both `favorites` and `lessons` for clarity.
  return {
    favorites,
    lessons: favorites,
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}
