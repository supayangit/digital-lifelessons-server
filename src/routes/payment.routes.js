import { Router } from "express";
import express from "express";
import { asyncHandler } from "../middlewares/errorHandler.js";
import * as PaymentController from "../controllers/payment.controller.js";

const router = Router();

// Stripe webhook — must receive raw body for signature verification
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

// Create checkout session
router.post(
  "/create-checkout-session",
  asyncHandler(PaymentController.createCheckoutSession)
);

export default router;
