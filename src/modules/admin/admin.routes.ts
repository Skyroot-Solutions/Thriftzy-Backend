// ============================================================================
// ADMIN MODULE - ROUTES
// ============================================================================
// This file defines all routes for admin operations.
// 
// Route groups:
// - Authentication (public - register, login)
// - Dashboard (admin only - statistics)
// - Store Management (admin only - list, view, approve)
// - Revenue Analytics (admin only - revenue reports)
// - Payout Management (admin only - process payouts)
// - Wallet (admin only - view balance)
// ============================================================================

import { Router, Request, Response } from "express";
import { adminController } from "./admin.controller";
import { adminAuthenticate, superAdminOnly } from "./admin.middleware";

const router = Router();

/**
 * @route   POST /admin/auth/register
 * @desc    Register a new admin user
 * @access  Public (should be restricted in production)
 * @body    { name, email, password, role? }
 */
router.post("/auth/register", (req: Request, res: Response) =>
    adminController.register(req, res)
);

/**
 * @route   POST /admin/auth/login
 * @desc    Authenticate admin and get tokens
 * @access  Public
 * @body    { email, password }
 */
router.post("/auth/login", (req: Request, res: Response) =>
    adminController.login(req, res)
);


router.use(adminAuthenticate);

/**
 * @route   GET /admin/dashboard/stats
 * @desc    Get dashboard statistics (revenue, orders, stores, users)
 * @access  Admin only
 */
router.get("/dashboard/stats", (req: Request, res: Response) =>
    adminController.getDashboardStats(req, res)
);


/**
 * @route   GET /admin/stores
 * @desc    Get all stores with seller details
 * @access  Admin only
 * @query   status (pending|verified), search, page, limit
 */
router.get("/stores", (req: Request, res: Response) =>
    adminController.getStores(req, res)
);

/**
 * @route   GET /admin/stores/:id
 * @desc    Get a single store by ID with seller details
 * @access  Admin only
 */
router.get("/stores/:id", (req: Request, res: Response) =>
    adminController.getStoreById(req, res)
);

/**
 * @route   GET /admin/sellers
 * @desc    Get all sellers with their stores
 * @access  Admin only
 */
router.get("/sellers", (req: Request, res: Response) =>
    adminController.getSellers(req, res)
);

/**
 * @route   GET /admin/sellers/:id
 * @desc    Get a single seller by ID with enriched data
 * @access  Admin only
 */
router.get("/sellers/:id", (req: Request, res: Response) =>
    adminController.getSellerById(req, res)
);

/**
 * @route   PATCH /admin/stores/:id/status
 * @desc    Update store verification status (approve/reject)
 * @access  Admin only
 * @body    { is_verified, is_active? }
 */
router.patch("/stores/:id/status", (req: Request, res: Response) =>
    adminController.updateStoreStatus(req, res)
);


/**
 * @route   GET /admin/revenue/by-store
 * @desc    Get revenue breakdown by store
 * @access  Admin only
 */
router.get("/revenue/by-store", (req: Request, res: Response) =>
    adminController.getRevenueByStore(req, res)
);

/**
 * @route   GET /admin/revenue/total
 * @desc    Get total revenue summary
 * @access  Admin only
 */
router.get("/revenue/total", (req: Request, res: Response) =>
    adminController.getTotalRevenue(req, res)
);

/**
 * @route   GET /admin/payouts
 * @desc    Get all payout requests
 * @access  Admin only
 * @query   status, seller_id, page, limit
 */
router.get("/payouts", (req: Request, res: Response) =>
    adminController.getPayoutRequests(req, res)
);

/**
 * @route   POST /admin/payouts/:id/process
 * @desc    Process a payout request (approve/reject)
 * @access  Admin only
 * @body    { status (approved|rejected), admin_notes?, transaction_id? }
 */
router.post("/payouts/:id/process", (req: Request, res: Response) =>
    adminController.processPayoutRequest(req, res)
);

/**
 * @route   GET /admin/wallet
 * @desc    Get admin wallet balance
 * @access  Admin only
 */
router.get("/wallet", (req: Request, res: Response) =>
    adminController.getWallet(req, res)
);

// ============== PROFIT & COMMISSION ==============

/**
 * @route   GET /admin/profit/total
 * @desc    Get total admin profit (commission earned)
 * @access  Admin only
 */
router.get("/profit/total", (req: Request, res: Response) =>
    adminController.getTotalProfit(req, res)
);

/**
 * @route   GET /admin/profit/by-store
 * @desc    Get profit breakdown by store
 * @access  Admin only
 */
router.get("/profit/by-store", (req: Request, res: Response) =>
    adminController.getProfitByStore(req, res)
);

/**
 * @route   GET /admin/commission
 * @desc    Get current commission settings
 * @access  Admin only
 */
router.get("/commission", (req: Request, res: Response) =>
    adminController.getCommissionSettings(req, res)
);

/**
 * @route   PUT /admin/commission
 * @desc    Update commission rate (Super Admin only)
 * @access  Super Admin only
 * @body    { commission_rate (0-1), update_note? }
 */
router.put("/commission", superAdminOnly, (req: Request, res: Response) =>
    adminController.updateCommissionRate(req, res)
);

export { router as adminRoutes };
