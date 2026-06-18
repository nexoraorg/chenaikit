import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controllers/authController";
import { asyncHandler } from "../middleware/errorHandler";

const router: ExpressRouter = Router();
const controller = new AuthController();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many requests, try again later." },
});

router.post(
  "/register",
  authLimiter,
  asyncHandler(controller.register.bind(controller)),
);
router.post(
  "/login",
  authLimiter,
  asyncHandler(controller.login.bind(controller)),
);
router.post(
  "/refresh",
  authLimiter,
  asyncHandler(controller.refreshToken.bind(controller)),
);

export default router;
