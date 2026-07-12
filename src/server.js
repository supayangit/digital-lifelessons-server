import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const { connectDB } = await import("./config/db.js");
const { createAuth } = await import("./auth/auth.js");
const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Validate critical environment variables
    const required = [
      "MONGODB_URI",
      "DB_NAME",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "CLIENT_URL",
    ];

    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }

    // 2. Connect to MongoDB
    await connectDB();

    // 3. Initialize Better Auth (requires DB to be connected)
    createAuth();

    // 4. Seed admin user if ADMIN_EMAIL is set and no admin exists
    await seedAdminIfNeeded();

    // 5. Start HTTP server
    app.listen(PORT, () => {
      console.log(`[v0] Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
      console.log(`[v0] Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error("[v0] Failed to start server:", err.message);
    process.exit(1);
  }
}

async function seedAdminIfNeeded() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  const { getDB } = await import("./config/db.js");
  const db = getDB();

  const existing = await db.collection("user").findOne({ email: adminEmail });
  if (existing && existing.role === "admin") {
    console.log(`[v0] Admin user already exists: ${adminEmail}`);
    return;
  }

  if (existing) {
    await db
      .collection("user")
      .updateOne({ email: adminEmail }, { $set: { role: "admin", updatedAt: new Date() } });
    console.log(`[v0] Promoted existing user to admin: ${adminEmail}`);
  } else {
    console.log(`[v0] ADMIN_EMAIL set but user not found yet. Register with ${adminEmail} to auto-promote.`);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[v0] SIGTERM received. Shutting down gracefully...");
  const { closeDB } = await import("./config/db.js");
  await closeDB();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[v0] SIGINT received. Shutting down...");
  const { closeDB } = await import("./config/db.js");
  await closeDB();
  process.exit(0);
});

startServer();
