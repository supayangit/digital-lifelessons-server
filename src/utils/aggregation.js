import { getDB } from "../config/db.js";

/**
 * Returns lessons ordered by favoritesCount (desc).
 */
export async function getMostSavedLessons({ limit = 10, skip = 0 } = {}) {
  const db = getDB();
  return db
    .collection("lessons")
    .aggregate([
      { $match: { visibility: "public" } },
      { $sort: { favoritesCount: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ])
    .toArray();
}

/**
 * Returns top contributors with most lessons created this week.
 */
export async function getTopContributors({ limit = 10 } = {}) {
  const db = getDB();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return db
    .collection("lessons")
    .aggregate([
      {
        $match: {
          visibility: "public",
          createdAt: { $gte: oneWeekAgo },
        },
      },
      {
        $group: {
          _id: "$creatorId",
          lessonCount: { $sum: 1 },
          creatorName: { $first: "$creatorName" },
          creatorEmail: { $first: "$creatorEmail" },
          creatorPhoto: { $first: "$creatorPhoto" },
        },
      },
      { $sort: { lessonCount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          creatorId: "$_id",
          creatorName: 1,
          creatorEmail: 1,
          creatorPhoto: 1,
          lessonCount: 1,
        },
      },
    ])
    .toArray();
}

/**
 * Returns dashboard analytics for a specific user.
 */
export async function getUserDashboardAnalytics(userId, userObjectId) {
  const db = getDB();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalLessons,
    totalFavorites,
    totalLikes,
    recentLessons,
    weeklyLessonCounts,
    weeklyLikeCounts,
    monthlyLessonCounts,
    monthlyFavoriteCounts,
  ] = await Promise.all([
    db.collection("lessons").countDocuments({ creatorId: userObjectId }),
    db.collection("favorites").countDocuments({ userId: userObjectId }),
    db.collection("likes").countDocuments({ userId: userObjectId }),
    db
      .collection("lessons")
      .find({ creatorId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    db
      .collection("lessons")
      .aggregate([
        { $match: { creatorId: userObjectId, createdAt: { $gte: startOfWeek } } },
        {
          $group: {
            _id: { $isoDayOfWeek: "$createdAt" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            dayOfWeek: "$_id",
            lessons: "$count",
          },
        },
      ])
      .toArray(),
    db
      .collection("likes")
      .aggregate([
        { $match: { userId: userObjectId, createdAt: { $gte: startOfWeek } } },
        {
          $group: {
            _id: { $isoDayOfWeek: "$createdAt" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            dayOfWeek: "$_id",
            likes: "$count",
          },
        },
      ])
      .toArray(),
    db
      .collection("lessons")
      .aggregate([
        { $match: { creatorId: userObjectId, createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            lessons: "$count",
          },
        },
      ])
      .toArray(),
    db
      .collection("favorites")
      .aggregate([
        { $match: { userId: userObjectId, createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            favorites: "$count",
          },
        },
      ])
      .toArray(),
  ]);

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyLessonMap = new Map(weeklyLessonCounts.map((item) => [item.dayOfWeek, item.lessons]));
  const weeklyLikeMap = new Map(weeklyLikeCounts.map((item) => [item.dayOfWeek, item.likes]));

  const weeklyActivity = daysOfWeek.map((dayLabel, index) => {
    const dayOfWeek = index + 1; // ISO dayOfWeek: 1 = Monday
    return {
      day: dayLabel,
      lessons: weeklyLessonMap.get(dayOfWeek) || 0,
      likes: weeklyLikeMap.get(dayOfWeek) || 0,
    };
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyLessonMap = new Map(
    monthlyLessonCounts.map((item) => [`${item.year}-${item.month}`, item.lessons])
  );
  const monthlyFavoriteMap = new Map(
    monthlyFavoriteCounts.map((item) => [`${item.year}-${item.month}`, item.favorites])
  );

  const monthlyActivity = [];
  for (let offset = 0; offset < 6; offset += 1) {
    const monthDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + offset, 1);
    const key = `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`;
    monthlyActivity.push({
      month: monthNames[monthDate.getMonth()],
      lessons: monthlyLessonMap.get(key) || 0,
      favorites: monthlyFavoriteMap.get(key) || 0,
    });
  }

  const [weeklyStats, monthlyStats] = await Promise.all([
    db.collection("lessons").countDocuments({ creatorId: userObjectId, createdAt: { $gte: startOfWeek } }),
    db.collection("lessons").countDocuments({ creatorId: userObjectId, createdAt: { $gte: startOfMonth } }),
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const chartData = await db
    .collection("lessons")
    .aggregate([
      { $match: { creatorId: userObjectId, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  return {
    totalLessons,
    totalFavorites,
    totalLikes,
    recentLessons,
    weeklyStats,
    monthlyStats,
    weeklyActivity,
    monthlyActivity,
    chartData,
  };
}

/**
 * Returns platform-wide admin analytics.
 */
export async function getAdminAnalytics() {
  const db = getDB();

  const [totalUsers, totalLessons, totalPublicLessons, totalReports] = await Promise.all([
    db.collection("user").countDocuments({}),
    db.collection("lessons").countDocuments({}),
    db.collection("lessons").countDocuments({ visibility: "public" }),
    db.collection("lessonReports").countDocuments({}),
  ]);

  const topContributors = await getTopContributors({ limit: 5 });

  // Monthly user growth (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const userGrowth = await db
    .collection("user")
    .aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const lessonGrowth = await db
    .collection("lessons")
    .aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  return {
    totalUsers,
    totalLessons,
    totalPublicLessons,
    totalReports,
    topContributors,
    userGrowth,
    lessonGrowth,
  };
}

/**
 * Returns reported lessons with aggregated report info.
 */
export async function getReportedLessonsAggregation({ skip = 0, limit = 20 } = {}) {
  const db = getDB();

  return db
    .collection("lessonReports")
    .aggregate([
      {
        $group: {
          _id: "$lessonId",
          reportCount: { $sum: 1 },
          reasons: { $push: "$reason" },
          reporters: {
            $push: {
              reporterId: "$reporterId",
              reporterEmail: "$reporterEmail",
              createdAt: "$createdAt",
            },
          },
        },
      },
      { $sort: { reportCount: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "lessons",
          localField: "_id",
          foreignField: "_id",
          as: "lesson",
        },
      },
      { $unwind: { path: "$lesson", preserveNullAndEmpty: true } },
      {
        $project: {
          lessonId: "$_id",
          _id: 0,
          reportCount: 1,
          reasons: 1,
          reporters: 1,
          lesson: 1,
        },
      },
    ])
    .toArray();
}
