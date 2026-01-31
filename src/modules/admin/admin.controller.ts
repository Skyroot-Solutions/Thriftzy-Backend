// ============================================================================
// ADMIN MODULE - CONTROLLER
// ============================================================================
// This controller handles all HTTP request/response logic for admin operations.
// 
// Endpoints:
// - Authentication (register, login)
// - Dashboard (statistics)
// - Store Management (list, view, update status)
// - Revenue Analytics (by store, total)
// - Payout Management (list, process)
// - Wallet (view balance)
// ============================================================================

import { Request, Response } from "express";
import { adminService } from "./admin.service";
import {
    AdminLoginRequest,
    AdminRegisterRequest,
    StoreQueryParams,
    UpdateStoreStatusRequest,
    ProcessPayoutRequest,
    PayoutQueryParams,
    AdminError,
    AdminUnauthorizedError,
    AdminForbiddenError
} from "./admin.types";
import { NotFoundError, ValidationError } from "../auth/auth.types";

export class AdminController {

    /**
     * POST /admin/auth/register
     * Register a new admin user
     */
    async register(req: Request, res: Response): Promise<void> {
        try {
            const data: AdminRegisterRequest = req.body;

            if (!data.name || !data.email || !data.password) {
                res.status(400).json({
                    success: false,
                    message: "Name, email, and password are required"
                });
                return;
            }

            const result = await adminService.register(data);
            res.status(201).json(result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * POST /admin/auth/login
     * Authenticate admin and return tokens
     */
    async login(req: Request, res: Response): Promise<void> {
        try {
            const data: AdminLoginRequest = req.body;

            if (!data.email || !data.password) {
                res.status(400).json({
                    success: false,
                    message: "Email and password are required"
                });
                return;
            }

            const result = await adminService.login(data);
            res.status(200).json(result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/dashboard/stats
     * Get dashboard statistics
     */
    async getDashboardStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await adminService.getDashboardStats();

            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/stores
     * Get all stores with seller details (with filtering)
     */
    async getStores(req: Request, res: Response): Promise<void> {
        try {
            const params: StoreQueryParams = {
                status: req.query.status as StoreQueryParams["status"],
                search: req.query.search as string,
                page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
                limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10
            };

            const result = await adminService.getStores(params);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/sellers
     * Get all sellers with their id, user name and store names
     * Access: Admin only
     */
    async getSellers(req: Request, res: Response): Promise<void> {
        try {
            const sellers = await adminService.getAllSellersWithStores();

            res.status(200).json({
                success: true,
                data: sellers
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/sellers/:id
     * Get a single seller by ID with enriched data
     * Access: Admin only
     */
    async getSellerById(req: Request, res: Response): Promise<void> {
        try {
            const sellerId = parseInt(req.params.id, 10);

            if (isNaN(sellerId)) {
                res.status(400).json({
                    success: false,
                    message: "Invalid seller ID"
                });
                return;
            }

            const seller = await adminService.getSellerById(sellerId);

            res.status(200).json({
                success: true,
                data: seller
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/stores/:id
     * Get a single store by ID with seller details
     */
    async getStoreById(req: Request, res: Response): Promise<void> {
        try {
            const storeId = parseInt(req.params.id, 10);

            if (isNaN(storeId)) {
                res.status(400).json({
                    success: false,
                    message: "Invalid store ID"
                });
                return;
            }

            const store = await adminService.getStoreById(storeId);

            res.status(200).json({
                success: true,
                data: store
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * PATCH /admin/stores/:id/status
     * Update store verification status
     */
    async updateStoreStatus(req: Request, res: Response): Promise<void> {
        try {
            const storeId = parseInt(req.params.id, 10);

            if (isNaN(storeId)) {
                res.status(400).json({
                    success: false,
                    message: "Invalid store ID"
                });
                return;
            }

            const data: UpdateStoreStatusRequest = req.body;

            if (typeof data.is_verified !== "boolean") {
                res.status(400).json({
                    success: false,
                    message: "is_verified is required and must be a boolean"
                });
                return;
            }

            const store = await adminService.updateStoreStatus(storeId, data);

            res.status(200).json({
                success: true,
                message: data.is_verified ? "Store verified successfully" : "Store verification revoked",
                data: store
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/revenue/by-store
     * Get revenue breakdown by store
     */
    async getRevenueByStore(req: Request, res: Response): Promise<void> {
        try {
            const revenue = await adminService.getRevenueByStore();

            res.status(200).json({
                success: true,
                data: revenue
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/revenue/total
     * Get total revenue summary
     */
    async getTotalRevenue(req: Request, res: Response): Promise<void> {
        try {
            const revenue = await adminService.getTotalRevenue();

            res.status(200).json({
                success: true,
                data: revenue
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/payouts
     * Get all payout requests (with filtering)
     */
    async getPayoutRequests(req: Request, res: Response): Promise<void> {
        try {
            const params: PayoutQueryParams = {
                status: req.query.status as PayoutQueryParams["status"],
                seller_id: req.query.seller_id ? parseInt(req.query.seller_id as string, 10) : undefined,
                page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
                limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10
            };

            const result = await adminService.getPayoutRequests(params);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * POST /admin/payouts/:id/process
     * Process a payout request (approve/reject)
     */
    async processPayoutRequest(req: Request, res: Response): Promise<void> {
        try {
            const adminId = req.adminId!;
            const payoutId = parseInt(req.params.id, 10);

            if (isNaN(payoutId)) {
                res.status(400).json({
                    success: false,
                    message: "Invalid payout ID"
                });
                return;
            }

            const data: ProcessPayoutRequest = req.body;

            if (!data.status || !["approved", "rejected"].includes(data.status)) {
                res.status(400).json({
                    success: false,
                    message: "status is required and must be 'approved' or 'rejected'"
                });
                return;
            }

            const payout = await adminService.processPayoutRequest(adminId, payoutId, data);

            res.status(200).json({
                success: true,
                message: `Payout ${data.status} successfully`,
                data: payout
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/wallet
     * Get admin wallet balance
     */
    async getWallet(req: Request, res: Response): Promise<void> {
        try {
            const wallet = await adminService.getAdminWallet();

            res.status(200).json({
                success: true,
                data: wallet
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/profit/total
     * Get total admin profit (commission earned)
     */
    async getTotalProfit(req: Request, res: Response): Promise<void> {
        try {
            const profit = await adminService.getTotalProfit();

            res.status(200).json({
                success: true,
                data: profit
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/profit/by-store
     * Get profit breakdown by store
     */
    async getProfitByStore(req: Request, res: Response): Promise<void> {
        try {
            const profit = await adminService.getProfitByStore();

            res.status(200).json({
                success: true,
                data: profit
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /admin/commission
     * Get current commission settings
     */
    async getCommissionSettings(req: Request, res: Response): Promise<void> {
        try {
            const settings = await adminService.getCommissionSettings();

            res.status(200).json({
                success: true,
                data: settings
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * PUT /admin/commission
     * Update commission rate
     */
    async updateCommissionRate(req: Request, res: Response): Promise<void> {
        try {
            const adminId = req.adminId!;
            const { commission_rate, update_note } = req.body;

            if (typeof commission_rate !== "number") {
                res.status(400).json({
                    success: false,
                    message: "commission_rate is required and must be a number (0-1)"
                });
                return;
            }

            if (commission_rate < 0 || commission_rate > 1) {
                res.status(400).json({
                    success: false,
                    message: "commission_rate must be between 0 and 1 (0% to 100%)"
                });
                return;
            }

            const settings = await adminService.updateCommissionRate(adminId, {
                commission_rate,
                update_note
            });

            res.status(200).json({
                success: true,
                message: `Commission rate updated to ${commission_rate * 100}%`,
                data: settings
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * Centralized error handler for admin controller
     */
    private handleError(res: Response, error: unknown): void {
        console.error("Admin Controller Error:", error);

        if (error instanceof AdminUnauthorizedError) {
            res.status(401).json({
                success: false,
                message: error.message
            });
            return;
        }

        if (error instanceof AdminForbiddenError) {
            res.status(403).json({
                success: false,
                message: error.message
            });
            return;
        }

        if (error instanceof NotFoundError) {
            res.status(404).json({
                success: false,
                message: error.message
            });
            return;
        }

        if (error instanceof ValidationError) {
            res.status(422).json({
                success: false,
                message: error.message
            });
            return;
        }

        if (error instanceof AdminError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "An unexpected error occurred"
        });
    }
}

// Export singleton instance
export const adminController = new AdminController();
