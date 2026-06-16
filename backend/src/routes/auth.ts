import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/authController';

const router: ExpressRouter = Router();
const controller = new AuthController();


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many requests, try again later.' },
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Creates a new user account with email and password. Passwords must be at least 8 characters.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered
 *                 userId:
 *                   type: string
 *                   example: clx1234567890
 *       400:
 *         description: Validation error or email already registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email already registered
 *       429:
 *         description: Rate limit exceeded (max 10 requests per 15 minutes)
 */
router.post('/register', authLimiter, controller.register.bind(controller));

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticates a user with email and password. Returns JWT access token and a refresh token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful — returns access and refresh tokens
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthTokenResponse'
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid credentials
 *       429:
 *         description: Rate limit exceeded (max 10 requests per 15 minutes)
 */
router.post('/login', authLimiter, controller.login.bind(controller));

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Exchanges a valid refresh token for a new access token. The refresh token is rotated on each use.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshRequest'
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIs...
 *       403:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Refresh token expired
 *       429:
 *         description: Rate limit exceeded (max 10 requests per 15 minutes)
 */
router.post('/refresh', authLimiter, controller.refreshToken.bind(controller));

export default router;
