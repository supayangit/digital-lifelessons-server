import { Router } from "express";
import express from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { verifySession } from "../middlewares/verifySession.js";
import * as PaymentController from "../controllers/payment.controller.js";

const router = Router();

// Stripe webhook — must receive raw body for signature verification
// Note: The raw body middleware is applied BEFORE express.json() for this specific route in app.js
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(PaymentController.stripeWebhook)
);

router.get("/webhook", (req, res) => {
  res.status(405).json({
    success: false,
    message: "Stripe webhook endpoint accepts POST only. Do not visit this URL from a browser.",
  });
});

router.get(
  "/confirm-checkout-session",
  asyncHandler(PaymentController.confirmCheckoutSession)
);

// Create checkout session (protected)
router.post(
  "/create-checkout-session",
  verifySession,
  asyncHandler(PaymentController.createCheckoutSession)
);

export default router;
