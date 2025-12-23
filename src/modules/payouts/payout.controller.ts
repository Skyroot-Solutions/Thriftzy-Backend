import { Request, Response } from "express";
import { payoutService } from "./payout.service";
import { CreatePayoutRequestDto } from "./payout.types";
import { NotFoundError, ValidationError } from "../auth/auth.types";

export class PayoutController {

    /**
     * GET /payouts/earnings
     * Get seller's total earnings summary
     */
    async getSellerEarnings(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const earnings = await payoutService.getSellerEarnings(userId);

            res.status(200).json({
                success: true,
                data: earnings
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /payouts/earnings/by-store
     * Get earnings breakdown by store
     */
    async getEarningsByStore(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const earnings = await payoutService.getEarningsByStore(userId);

            res.status(200).json({
                success: true,
                data: earnings
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * POST /payouts/request
     * Create a new payout request
     */
    async createPayoutRequest(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const data: CreatePayoutRequestDto = req.body;

            const payout = await payoutService.createPayoutRequest(userId, data);

            res.status(201).json({
                success: true,
                message: "Payout request submitted successfully",
                data: payout
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /payouts
     * Get seller's payout requests
     * @query status - Filter by payout status
     * @query store_id - Optional, filter by store
     */
    async getSellerPayouts(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const status = req.query.status as string | undefined;
            const storeId = req.query.store_id ? parseInt(req.query.store_id as string, 10) : undefined;

            const payouts = await payoutService.getSellerPayouts(userId, status, storeId);

            res.status(200).json({
                success: true,
                data: payouts
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /payouts/:id
     * Get specific payout by ID
     */
    async getPayoutById(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const payoutId = parseInt(req.params.id);

            if (isNaN(payoutId)) {
                res.status(400).json({
                    success: false,
                    message: "Invalid payout ID"
                });
                return;
            }

            const payout = await payoutService.getPayoutById(userId, payoutId);

            res.status(200).json({
                success: true,
                data: payout
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * Centralized error handler
     */
    private handleError(res: Response, error: unknown): void {
        console.error("Payout Controller Error:", error);

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

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

// Export singleton instance
export const payoutController = new PayoutController();
