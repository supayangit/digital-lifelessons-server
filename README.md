# Digital Life Lessons — Backend API

Production-ready Node.js/Express REST API for the Digital Life Lessons SaaS platform.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express.js |
| Database | MongoDB Atlas (Native Driver) |
| Auth | Better Auth (email/password + Google OAuth) |
| Payments | Stripe Checkout |
| File Storage | Cloudinary |
| Validation | Zod |
| Security | Helmet, CORS, express-rate-limit, express-mongo-sanitize |

---

## Folder Structure

```
server/
└── src/
    ├── config/          # DB, Stripe, Cloudinary initialization
    ├── auth/            # Better Auth configuration
    ├── routes/          # Express routers
    ├── controllers/     # Request handlers (thin layer)
    ├── services/        # Business logic & DB queries
    ├── middlewares/     # verifySession, verifyAdmin, verifyPremium, verifyLessonOwner, errorHandler
    ├── utils/           # readingTime, pagination, aggregation pipelines
    ├── validations/     # Zod schemas
    ├── constants/       # Shared constants (roles, categories, tones, etc.)
    ├── app.js           # Express app setup
    └── server.js        # Entry point
```

---

## Getting Started

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in all values in `.env`. Key variables:

- `MONGODB_URI` — MongoDB Atlas connection string
- `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — from Stripe dashboard
- `CLOUDINARY_*` — from Cloudinary dashboard
- `ADMIN_EMAIL` — auto-promoted to admin on first registration

### 3. Start development server

```bash
npm run dev
```

### 4. Start production server

```bash
npm start
```

---

## API Reference

### Authentication (`/api/auth/*`)

Handled by Better Auth. All standard endpoints are available:

| Endpoint | Description |
|---|---|
| `POST /api/auth/sign-up/email` | Register with email/password |
| `POST /api/auth/sign-in/email` | Login with email/password |
| `POST /api/auth/sign-out` | Sign out |
| `GET /api/auth/session` | Get current session |
| `GET /api/auth/sign-in/google` | Google OAuth sign-in |

---

### Lessons (`/api/lessons`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List lessons with pagination, search, filter, sort |
| GET | `/featured` | Public | Featured lessons |
| GET | `/top-contributors` | Public | Top lesson contributors all time |
| GET | `/most-saved` | Public | Most favorited lessons |
| GET | `/:id` | Public* | Get lesson (premium lock for free users) |
| POST | `/` | Session | Create lesson |
| PATCH | `/:id` | Owner/Admin | Update lesson |
| DELETE | `/:id` | Owner/Admin | Delete lesson |
| PATCH | `/:id/visibility` | Owner | Toggle public/private |
| PATCH | `/:id/access-level` | Premium/Owner | Change free/premium |
| PATCH | `/:id/like` | Session | Toggle like |
| GET | `/:userId/public-lessons` | Public | User's public lessons |

**Query params for `GET /`:** `page`, `limit`, `search`, `category`, `tone`, `sort` (`newest` | `most-saved`)

---

### Users (`/api/users`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/profile` | Session | Get own profile + counts |
| PATCH | `/profile` | Session | Update name / image |
| GET | `/:userId/public-lessons` | Public | User's public lessons |

---

### Favorites (`/api/favorites`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Session | Save lesson to favorites |
| DELETE | `/:lessonId` | Session | Remove from favorites |
| GET | `/my-favorites` | Session | My favorites (filter: category, tone) |

---

### Comments (`/api/comments`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Session | Add comment |
| GET | `/:lessonId` | Public | Get comments for a lesson |
| DELETE | `/:id` | Owner/Admin | Delete comment |

---

### Reports (`/api/reports`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Session | Report a lesson |

**Reason options:** `Spam`, `Harassment`, `Misleading`, `Inappropriate`, `Other`

---

### Payments (`/api/payments`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/create-checkout-session` | Session | Create Stripe checkout (1500 BDT one-time) |
| POST | `/webhook` | Stripe signature | Handle Stripe webhook events |

---

### Dashboard (`/api/dashboard`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/overview` | Session | Personal analytics (lessons, favorites, chart data) |

---

### Admin (`/api/admin`) — Admin role required

| Method | Endpoint | Description |
|---|---|---|
| GET | `/overview` | Platform analytics |
| GET | `/users` | Paginated/searchable user list |
| PATCH | `/users/:id/role` | Change user role |
| DELETE | `/users/:id` | Delete user |
| GET | `/lessons` | All lessons (filterable) |
| PATCH | `/lessons/:id/feature` | Toggle featured |
| PATCH | `/lessons/:id/review` | Mark reviewed |
| DELETE | `/lessons/:id` | Delete lesson |
| GET | `/reported-lessons` | Aggregated report view |
| PATCH | `/reported-lessons/:lessonId/ignore` | Clear reports |
| DELETE | `/reported-lessons/:lessonId` | Delete lesson + reports |

---

## Stripe Webhook Setup

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe listen --forward-to localhost:5000/api/payments/webhook`
3. Copy the webhook secret into `.env` as `STRIPE_WEBHOOK_SECRET`

In production, configure the webhook endpoint in your Stripe dashboard pointing to `https://yourdomain.com/api/payments/webhook`.

---

## Database Collections

| Collection | Purpose |
|---|---|
| `user` | Managed by Better Auth + custom fields (role, isPremium) |
| `lessons` | Lesson documents |
| `favorites` | User-lesson favorite pairs |
| `comments` | Lesson comments |
| `lessonReports` | User reports on lessons |
| `payments` | Stripe payment records |

> **Note:** Better Auth uses the collection name `user` (singular) by default with the MongoDB adapter.

---

## Security Features

- HTTP security headers via Helmet
- CORS configured to CLIENT_URL only
- Rate limiting (200 req/15min global; 20 req/15min for auth)
- MongoDB query injection prevention via express-mongo-sanitize
- Stripe webhook signature verification
- Session-based auth with secure, httpOnly cookies
- Role-based access control (user / admin)
- Premium tier access control
- Ownership verification middleware
- Centralized error handling (no stack traces in production)
- Zod schema validation on all input
# digital-lifelessons-backend
