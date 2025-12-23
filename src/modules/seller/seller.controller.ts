import { Request, Response } from "express";
import { sellerService } from "./seller.service";
import {
    CreateStoreRequest,
    UpdateStoreRequest,
    CreateProductRequest,
    UpdateProductRequest,
    UpdateOrderStatusRequest,
    ProductFilters,
    OrderFilters,
    PayoutFilters
} from "./seller.types";
import { AuthError } from "../auth/auth.types";

export class SellerController {

    // ============== DASHBOARD ==============

    /**
     * GET /seller/dashboard
     * Get seller dashboard with stats
     * @query store_id - Optional, filter stats for specific store
     */
    async getDashboard(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const storeId = req.query.store_id ? parseInt(req.query.store_id as string, 10) : undefined;
            const dashboard = await sellerService.getSellerDashboard(userId, storeId);

            res.status(200).json({
                success: true,
                data: dashboard
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * GET /seller/profile
     * Get seller profile
     */
    async getProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const profile = await sellerService.getSellerProfile(userId);

            res.status(200).json({
                success: true,
                data: profile
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    // ============== STORES ==============

    /**
     * GET /seller/stores
     * Get all stores for the seller
     */
    async getStores(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const stores = await sellerService.getStores(userId);

            res.status(200).json({
                success: true,
                data: stores
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * GET /seller/stores/:id
     * Get store by ID
     */
    async getStoreById(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const storeId = parseInt(req.params.id, 10);

            if (isNaN(storeId)) {
                res.status(400).json({ success: false, message: "Invalid store ID" });
                return;
            }

            const store = await sellerService.getStoreById(userId, storeId);

            res.status(200).json({
                success: true,
                data: store
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * POST /seller/stores
     * Create a new store
     */
    async createStore(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const data: CreateStoreRequest = req.body;

            const store = await sellerService.createStore(userId, data);

            res.status(201).json({
                success: true,
                message: "Store created successfully",
                data: store
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * PATCH /seller/stores/:id
     * Update store
     */
    async updateStore(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const storeId = parseInt(req.params.id, 10);
            const data: UpdateStoreRequest = req.body;

            if (isNaN(storeId)) {
                res.status(400).json({ success: false, message: "Invalid store ID" });
                return;
            }

            const store = await sellerService.updateStore(userId, storeId, data);

            res.status(200).json({
                success: true,
                message: "Store updated successfully",
                data: store
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * DELETE /seller/stores/:id
     * Delete store
     */
    async deleteStore(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const storeId = parseInt(req.params.id, 10);

            if (isNaN(storeId)) {
                res.status(400).json({ success: false, message: "Invalid store ID" });
                return;
            }

            await sellerService.deleteStore(userId, storeId);

            res.status(200).json({
                success: true,
                message: "Store deleted successfully"
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    // ============== PRODUCTS ==============

    /**
     * GET /seller/products
     * Get all products
     */
    async getProducts(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const filters: ProductFilters = {
                page: parseInt(req.query.page as string, 10) || 1,
                limit: parseInt(req.query.limit as string, 10) || 10,
                store_id: req.query.store_id ? parseInt(req.query.store_id as string, 10) : undefined,
                category: req.query.category as string,
                condition: req.query.condition as ProductFilters["condition"]
            };

            const result = await sellerService.getProducts(userId, filters);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * GET /seller/products/:id
     * Get product by ID
     */
    async getProductById(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const productId = parseInt(req.params.id, 10);

            if (isNaN(productId)) {
                res.status(400).json({ success: false, message: "Invalid product ID" });
                return;
            }

            const product = await sellerService.getProductById(userId, productId);

            res.status(200).json({
                success: true,
                data: product
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * POST /seller/products
     * Create a new product
     */
    async createProduct(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const data: CreateProductRequest = req.body;

            const product = await sellerService.createProduct(userId, data);

            res.status(201).json({
                success: true,
                message: "Product created successfully",
                data: product
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * PATCH /seller/products/:id
     * Update product
     */
    async updateProduct(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const productId = parseInt(req.params.id, 10);
            const data: UpdateProductRequest = req.body;

            if (isNaN(productId)) {
                res.status(400).json({ success: false, message: "Invalid product ID" });
                return;
            }

            const product = await sellerService.updateProduct(userId, productId, data);

            res.status(200).json({
                success: true,
                message: "Product updated successfully",
                data: product
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * DELETE /seller/products/:id
     * Delete product
     */
    async deleteProduct(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const productId = parseInt(req.params.id, 10);

            if (isNaN(productId)) {
                res.status(400).json({ success: false, message: "Invalid product ID" });
                return;
            }

            await sellerService.deleteProduct(userId, productId);

            res.status(200).json({
                success: true,
                message: "Product deleted successfully"
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    // ============== ORDERS ==============

    /**
     * GET /seller/orders
     * Get all orders received
     */
    async getOrders(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const filters: OrderFilters = {
                page: parseInt(req.query.page as string, 10) || 1,
                limit: parseInt(req.query.limit as string, 10) || 10,
                store_id: req.query.store_id ? parseInt(req.query.store_id as string, 10) : undefined,
                status: req.query.status as OrderFilters["status"]
            };

            const result = await sellerService.getOrders(userId, filters);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * GET /seller/orders/:id
     * Get order by ID
     */
    async getOrderById(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const orderId = parseInt(req.params.id, 10);

            if (isNaN(orderId)) {
                res.status(400).json({ success: false, message: "Invalid order ID" });
                return;
            }

            const order = await sellerService.getOrderById(userId, orderId);

            res.status(200).json({
                success: true,
                data: order
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    /**
     * PATCH /seller/orders/:id/status
     * Update order status
     */
    async updateOrderStatus(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const orderId = parseInt(req.params.id, 10);
            const data: UpdateOrderStatusRequest = req.body;

            if (isNaN(orderId)) {
                res.status(400).json({ success: false, message: "Invalid order ID" });
                return;
            }

            const order = await sellerService.updateOrderStatus(userId, orderId, data);

            res.status(200).json({
                success: true,
                message: "Order status updated successfully",
                data: order
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    // ============== PAYOUTS ==============

    /**
     * GET /seller/payouts
     * Get all payouts
     */
    async getPayouts(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.userId!;
            const filters: PayoutFilters = {
                page: parseInt(req.query.page as string, 10) || 1,
                limit: parseInt(req.query.limit as string, 10) || 10,
                status: req.query.status as PayoutFilters["status"]
            };

            const result = await sellerService.getPayouts(userId, filters);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            this.handleError(error, res);
        }
    }

    // ============== ERROR HANDLER ==============

    private handleError(error: unknown, res: Response): void {
        console.error("Seller Error:", error);

        if (error instanceof AuthError) {
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
export const sellerController = new SellerController();
