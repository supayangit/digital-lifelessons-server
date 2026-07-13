import express from "express";
import dotenv from "dotenv";

// Load environment variables early so top-level initialization has them available.
dotenv.config({ path: ".env.local" });
dotenv.config();
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";

import { toNodeHandler } from "better-auth/node";
import { getAuth } from "./auth/auth.js";
import { connectDB } from "./config/db.js";
import { createAuth } from "./auth/auth.js";

// Ensure DB and Auth are initialized before the module finishes loading.
// Load env first (above) and only attempt DB init when a URI is present to
// avoid noisy errors in environments that import this module before server
// bootstrap sets env vars.
if (process.env.MONGODB_URI) {
  try {
    await connectDB();
    try {
      createAuth();
      console.log("[v0] DB & Auth initialized (top-level await)");
    } catch (e) {
      console.error("[v0] createAuth failed during top-level init:", e.message);
    }
  } catch (err) {
    console.error("[v0] DB init failed during top-level await:", err.message);
  }
} else {
  console.warn('[v0] Skipping top-level DB init: MONGODB_URI not set');
}

import { errorHandler } from "./middlewares/errorHandler.js";

import lessonRoutes from "./routes/lesson.routes.js";
import userRoutes from "./routes/user.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import favoriteRoutes from "./routes/favorite.routes.js";
import reportRoutes from "./routes/report.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import likeRoutes from "./routes/like.routes.js";

const app = express();

// Trust reverse proxy for secure cookies on Render
app.set("trust proxy", 1);

// ── Security Middleware ────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const CLIENT_URLS = [
  ...((process.env.CLIENT_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)),
  CLIENT_URL,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || CLIENT_URLS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked origin: ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for development
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});
app.use(limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120, // Increased from 20 for development
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Please slow down." },
});

// ── Cookie Parsing (required before Better Auth handlers) ──────────────────────
app.use(cookieParser());

app.use("/api/auth", (req, res) => {
  // Basic debug: log incoming auth request headers (authorization & cookie)
  console.log("[debug] AUTH HANDLER HIT", {
    method: req.method,
    url: req.originalUrl,
    authorization: req.headers.authorization || null,
    cookie: req.headers.cookie || null,
    userAgent: req.headers['user-agent'] || null,
    host: req.headers.host || null,
  });

  // Log request path details for login and token retrieval flows
  if (req.originalUrl.includes('/sign-in') || req.originalUrl.includes('/get-session')) {
    console.log('[debug] AUTH login-phase request', {
      method: req.method,
      path: req.originalUrl,
      headers: {
        authorization: req.headers.authorization || null,
        cookie: req.headers.cookie || null,
      },
    });
  }

  // Intercept setHeader to capture any Set-Cookie header emitted by better-auth
  const originalSetHeader = res.setHeader && res.setHeader.bind(res);
  if (originalSetHeader) {
    res.setHeader = (...args) => {
      try {
        if (typeof args[0] === 'string' && args[0].toLowerCase() === 'set-cookie') {
          console.log('[debug] AUTH set-cookie ->', args[1]);
        }
      } catch (e) {
        // ignore
      }
      return originalSetHeader(...args);
    };
  }

  return toNodeHandler(getAuth())(req, res);
});
// ── Better Auth Handler ────────────────────────────────────────────────────────
// IMPORTANT: Better Auth must be registered BEFORE express.json() to handle its own body parsing
app.all("/api/auth/*splat", authLimiter, (req, res) => {
  const authLog = {
    method: req.method,
    url: req.originalUrl,
    authorization: req.headers.authorization || null,
    cookie: req.headers.cookie || null,
    userAgent: req.headers['user-agent'] || null,
  };
  console.log('[debug] AUTH wildcard handler', authLog);

  if (req.originalUrl.includes('/sign-in') || req.originalUrl.includes('/get-session')) {
    console.log('[debug] AUTH wildcard login-phase request', authLog);
  }

  const originalSetHeader = res.setHeader && res.setHeader.bind(res);
  if (originalSetHeader) {
    res.setHeader = (...args) => {
      try {
        if (typeof args[0] === 'string' && args[0].toLowerCase() === 'set-cookie') {
          console.log('[debug] AUTH wildcard set-cookie ->', args[1]);
        }
      } catch (e) {
        // ignore
      }
      return originalSetHeader(...args);
    };
  }

  return toNodeHandler(getAuth())(req, res);
});

// ── Body Parsing ───────────────────────────────────────────────────────────────
// Note: Stripe webhook route uses raw body — handled per-route in payment.routes.js
// Mount payment routes before JSON parsing so /api/payments/webhook can receive raw body.
app.use("/api/payments", paymentRoutes);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Input Sanitization ─────────────────────────────────────────────────────────
app.use(mongoSanitize());

// ── Health Check ───────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Temporary Debug Endpoint (remove after troubleshooting) ───────────────────
app.all("/api/debug/headers", (req, res) => {
  try {
    console.log('[debug] /api/debug/headers incoming', {
      method: req.method,
      url: req.originalUrl,
      authorization: req.headers.authorization || null,
      cookie: req.headers.cookie || null,
    });
  } catch (e) {
    // ignore logging errors
  }

  return res.json({
    success: true,
    method: req.method,
    headers: req.headers,
    cookie: req.headers.cookie || null,
  });
});

// ── Debug Status / Session / Signout Endpoints (temporary) ──────────────────
app.get("/api/debug/status", async (req, res) => {
  let dbReady = false;
  let authReady = false;
  try {
    const db = await connectDB();
    // ping to validate connection
    await db.command({ ping: 1 });
    dbReady = true;
  } catch (e) {
    console.error('[v0] debug status DB check failed:', e.message);
  }

  try {
    const auth = getAuth();
    authReady = !!auth;
  } catch (e) {
    console.error('[v0] debug status auth check failed:', e.message);
  }

  const clientUrls = (process.env.CLIENT_URLS || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  if (process.env.CLIENT_URL) clientUrls.push(process.env.CLIENT_URL);

  return res.json({ success: true, db: dbReady, auth: authReady, trustedOrigins: clientUrls });
});

// Return the resolved session for the incoming request (useful for debugging tokens/cookies)
app.get('/api/debug/session', async (req, res) => {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    return res.json({ success: true, session });
  } catch (e) {
    console.error('[v0] debug session error:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Trigger sign-out using incoming headers (clears server-side session if cookie/token provided)
app.post('/api/debug/signout', async (req, res) => {
  try {
    const auth = getAuth();
    await auth.api.signOut({ headers: req.headers });
    return res.json({ success: true, message: 'Signed out (if session existed).' });
  } catch (e) {
    console.error('[v0] debug signout error:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ── Landing Page ───────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    version: "v0",
    status: "healthy",
    endpoints: {
      health: "/health",
      auth: "/api/auth/*",
      lessons: "/api/lessons",
      users: "/api/users",
      comments: "/api/comments",
      favorites: "/api/favorites",
      reports: "/api/reports",
      payments: "/api/payments",
      dashboard: "/api/dashboard",
      admin: "/api/admin"
    }
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use("/api/lessons", lessonRoutes);
app.use("/api/users", userRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", analyticsRoutes);
app.use("/api/admin", adminRoutes);

// ── 404 Handler ────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Centralized Error Handler ──────────────────────────────────────────────────
app.use(errorHandler);

export default app;
