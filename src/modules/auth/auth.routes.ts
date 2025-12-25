import { Router, Request, Response } from "express";
import { authController } from "./auth.controller";
import {
    authenticate,
    authRateLimit
} from "./auth.middleware";

const router = Router();

// ============== PUBLIC ROUTES ==============

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { name, email, phone, password, role? }
 */
router.post("/register", (req: Request, res: Response) => authController.register(req, res));

/**
 * @route   POST /auth/login
 * @desc    Login with email/phone and password
 * @access  Public
 * @body    { emailOrPhone, password }
 */
router.post("/login",  (req: Request, res: Response) => authController.login(req, res));

/**
 * @route   POST /auth/google
 * @desc    Login/Register with Google OAuth
 * @access  Public
 * @body    { idToken }
 */
router.post("/google", (req: Request, res: Response) => authController.googleOAuth(req, res));

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken }
 */
router.post("/refresh", (req: Request, res: Response) => authController.refreshToken(req, res));

/**
 * @route   POST /auth/logout
 * @desc    Logout current session (invalidate refresh token)
 * @access  Public
 * @body    { refreshToken }
 */
router.post("/logout", (req: Request, res: Response) => authController.logout(req, res));

// ============== PROTECTED ROUTES ==============

/**
 * @route   GET /auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get("/me", authenticate, (req: Request, res: Response) => authController.getCurrentUser(req, res));

/**
 * @route   POST /auth/change-password
 * @desc    Change password (requires current password)
 * @access  Private
 * @body    { currentPassword, newPassword }
 */
router.post("/change-password", authenticate, (req: Request, res: Response) => authController.changePassword(req, res));

/**
 * @route   POST /auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post("/logout-all", authenticate, (req: Request, res: Response) => authController.logoutAll(req, res));

export { router as authRoutes };
