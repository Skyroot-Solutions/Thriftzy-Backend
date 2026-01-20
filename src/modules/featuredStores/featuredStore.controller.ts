import { Request, Response } from "express";
import { featuredStoreService } from "./featuredStore.service";
import { NotFoundError, ValidationError } from "../auth/auth.types";

class FeaturedStoreController {
    // ============== SELLER ENDPOINTS ==============

    /**
     * Create featured store request
     * POST /seller/featured-requests
     */
    async createRequest(req: Request, res: Response) {
        try {
            const userId = (req as any).userId;
            const { store_id, message, requested_days } = req.body;

            if (!store_id) {
                return res.status(400).json({
                    success: false,
                    message: "store_id is required"
                });
            }

            const request = await featuredStoreService.createRequest(
                userId,
                store_id,
                { message, requested_days }
            );

            return res.status(201).json({
                success: true,
                message: "Featured request submitted successfully",
                data: request
            });
        } catch (error) {
            if (error instanceof NotFoundError) {
                return res.status(404).json({ success: false, message: error.message });
            }
            if (error instanceof ValidationError) {
                return res.status(400).json({ success: false, message: error.message });
            }
            console.error("Create featured request error:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    /**
     * Get seller's featured requests
     * GET /seller/featured-requests
     */
    async getSellerRequests(req: Request, res: Response) {
        try {
            const userId = (req as any).userId;
            const storeId = req.query.store_id ? parseInt(req.query.store_id as string) : undefined;

            const requests = await featuredStoreService.getSellerRequests(userId, storeId);

            return res.json({
                success: true,
                data: requests
            });
        } catch (error) {
            console.error("Get seller requests error:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    // ============== ADMIN ENDPOINTS ==============

    /**
     * Get all featured requests (Admin)
     * GET /admin/featured-requests
     */
    async getAllRequests(req: Request, res: Response) {
        try {
            const { status, page, limit } = req.query;

            const result = await featuredStoreService.getAllRequests({
                status: status as any,
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined
            });

            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error("Get all requests error:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    /**
     * Update featured request (Admin)
     * PATCH /admin/featured-requests/:id
     */
    async updateRequest(req: Request, res: Response) {
        try {
            const requestId = parseInt(req.params.id);
            const adminId = (req as any).adminId;
            const { status, admin_notes, featured_start_date, featured_end_date } = req.body;

            if (!status || !["approved", "rejected"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Valid status (approved/rejected) is required"
                });
            }

            const request = await featuredStoreService.updateRequest(requestId, adminId, {
                status,
                admin_notes,
                featured_start_date,
                featured_end_date
            });

            return res.json({
                success: true,
                message: `Request ${status} successfully`,
                data: request
            });
        } catch (error) {
            if (error instanceof NotFoundError) {
                return res.status(404).json({ success: false, message: error.message });
            }
            console.error("Update request error:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    // ============== PUBLIC ENDPOINTS ==============

    /**
     * Get active featured store (Public)
     * GET /stores/featured
     */
    async getActiveFeaturedStore(req: Request, res: Response) {
        try {
            const featuredStore = await featuredStoreService.getActiveFeaturedStore();

            return res.json({
                success: true,
                data: featuredStore
            });
        } catch (error) {
            console.error("Get featured store error:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

export const featuredStoreController = new FeaturedStoreController();
